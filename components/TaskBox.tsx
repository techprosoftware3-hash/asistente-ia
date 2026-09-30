"use client";

import { useEffect, useState } from "react";

type TaskBoxProps = {
  employeeId: string;
};

type Frequency = "once" | "daily" | "weekly";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  result: string | null;
  is_automated: boolean;
  scheduled_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  frequency: Frequency;
  started_at: string | null;
  completed_at: string | null;
};

export default function TaskBox({
  employeeId,
}: TaskBoxProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isAutomated, setIsAutomated] =
    useState(false);

  const [frequency, setFrequency] =
    useState<Frequency>("once");

  const [scheduledAt, setScheduledAt] =
    useState("");

  const [tasks, setTasks] = useState<Task[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] =
    useState(true);

  const [executingTaskId, setExecutingTaskId] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTasks() {
      try {
        const response = await fetch(
          `/api/tasks?employeeId=${employeeId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar las tareas."
          );
        }

        setTasks(data.tasks || []);
      } catch (error) {
        console.error(
          "Error cargando tareas:",
          error
        );
      } finally {
        setLoadingTasks(false);
      }
    }

    loadTasks();
  }, [employeeId]);

  async function createTask() {
    if (!title.trim() || loading) {
      return;
    }

    if (isAutomated && !scheduledAt) {
      setError(
        "Elegí cuándo querés que se ejecute la tarea."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          title: title.trim(),
          description: description.trim(),
          isAutomated,
          frequency: isAutomated
            ? frequency
            : "once",
          scheduledAt: isAutomated
            ? new Date(
                scheduledAt
              ).toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo crear la tarea."
        );
      }

      setTasks((current) => [
        data.task,
        ...current,
      ]);

      setTitle("");
      setDescription("");
      setIsAutomated(false);
      setFrequency("once");
      setScheduledAt("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  async function executeTask(taskId: string) {
    if (executingTaskId) {
      return;
    }

    setExecutingTaskId(taskId);
    setError("");

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "running",
            }
          : task
      )
    );

    try {
      const response = await fetch(
        "/api/tasks/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo ejecutar la tarea."
        );
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? data.task
            : task
        )
      );
    } catch (error) {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: "pending",
              }
            : task
        )
      );

      setError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error ejecutando la tarea."
      );
    } finally {
      setExecutingTaskId(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) {
      return null;
    }

    return new Date(date).toLocaleString(
      "es-AR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    );
  }

  function getFrequencyLabel(
    task: Task
  ) {
    if (task.frequency === "daily") {
      return "Diaria";
    }

    if (task.frequency === "weekly") {
      return "Semanal";
    }

    return "Una vez";
  }

  return (
    <section className="mb-6 rounded-3xl border bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">
            ⚙️
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Tareas
            </h2>

            <p className="text-sm text-gray-500">
              Asignale trabajos a tu empleado y
              programá ejecuciones automáticas.
            </p>
          </div>
        </div>
      </div>

      {/* Crear tarea */}
      <div className="rounded-2xl bg-gray-50 p-4">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Nueva tarea
        </label>

        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError("");
          }}
          placeholder="Ejemplo: Revisar nuevos prospectos"
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError("");
          }}
          placeholder="Descripción de la tarea..."
          className="mt-3 min-h-24 w-full resize-none rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        {/* Automatización */}
        <div className="mt-4 rounded-2xl border bg-white p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isAutomated}
              onChange={(e) => {
                setIsAutomated(
                  e.target.checked
                );
                setError("");
              }}
              className="h-4 w-4 rounded border-gray-300"
            />

            <div>
              <p className="text-sm font-semibold text-gray-900">
                Ejecutar automáticamente
              </p>

              <p className="text-xs text-gray-500">
                Nexo ejecutará esta tarea según
                la frecuencia elegida.
              </p>
            </div>
          </label>

          {isAutomated && (
            <div className="mt-4 space-y-4">
              {/* Frecuencia */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Frecuencia
                </label>

                <select
                  value={frequency}
                  onChange={(e) => {
                    setFrequency(
                      e.target.value as Frequency
                    );
                    setError("");
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="once">
                    Una vez
                  </option>

                  <option value="daily">
                    Diariamente
                  </option>

                  <option value="weekly">
                    Semanalmente
                  </option>
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Primera ejecución
                </label>

                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => {
                    setScheduledAt(
                      e.target.value
                    );
                    setError("");
                  }}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <p className="mt-2 text-xs text-gray-400">
                  La hora se interpreta según tu
                  dispositivo.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={createTask}
          disabled={
            loading || !title.trim()
          }
          className="mt-4 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading
            ? "Creando..."
            : isAutomated
              ? "＋ Programar tarea"
              : "＋ Crear tarea"}
        </button>
      </div>

      {/* Lista */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Tareas creadas
        </h3>

        {loadingTasks ? (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-gray-400">
              Cargando tareas...
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-gray-400">
              Todavía no hay tareas creadas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {task.title}
                      </h4>

                      {task.is_automated && (
                        <>
                          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                            Automática
                          </span>

                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            {getFrequencyLabel(
                              task
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    {task.description && (
                      <p className="mt-1 text-sm leading-5 text-gray-500">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      task.status ===
                      "completed"
                        ? "bg-green-50 text-green-700"
                        : task.status ===
                            "running"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {task.status ===
                    "completed"
                      ? "Completada"
                      : task.status ===
                          "running"
                        ? "Ejecutando..."
                        : "Pendiente"}
                  </span>
                </div>

                {task.is_automated &&
                  task.next_run_at && (
                    <div className="mt-4 rounded-xl bg-purple-50 p-3">
                      <p className="text-xs font-semibold text-purple-700">
                        Próxima ejecución
                      </p>

                      <p className="mt-1 text-sm text-purple-900">
                        {formatDate(
                          task.next_run_at
                        )}
                      </p>
                    </div>
                  )}

                {task.last_run_at && (
                  <p className="mt-3 text-xs text-gray-400">
                    Última ejecución:{" "}
                    {formatDate(
                      task.last_run_at
                    )}
                  </p>
                )}

                {/* Ejecución manual */}
                {task.status !==
                  "completed" && (
                  <button
                    type="button"
                    onClick={() =>
                      executeTask(task.id)
                    }
                    disabled={
                      executingTaskId !==
                      null
                    }
                    className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {executingTaskId ===
                    task.id
                      ? "Nexo está trabajando..."
                      : "▶ Ejecutar ahora"}
                  </button>
                )}

                {/* Resultado */}
                {task.result && (
                  <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Resultado de Nexo
                    </p>

                    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {task.result}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}