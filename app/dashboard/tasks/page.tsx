"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/app/context/ThemeContext";

type Task = {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  employees?: {
    name: string;
    role: string;
  };
};

export default function TasksPage() {
  const supabase = createClient();
  const { darkMode, toggleDarkMode, mounted } = useTheme();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [executingId, setExecutingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        employees (
          name,
          role
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  }

  // Ejecución Manual de una tarea (Corregido con res.text())
  async function handleManualExecution(task: Task) {
    setExecutingId(task.id);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: task.employee_id,
          message: `Ejecuta y procesa esta tarea pendiente: "${task.title}". Detalles: ${task.description}`
        }),
      });

      const responseText = await res.text();

      if (res.ok) {
        await supabase
          .from("tasks")
          .update({ status: "completed" })
          .eq("id", task.id);

        alert(`¡Tarea ejecutada con éxito por el agente! Respuesta: ${responseText}`);
        fetchTasks();
      } else {
        alert(`Error al ejecutar: ${responseText}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de red al intentar ejecutar la tarea.");
    } finally {
      setExecutingId(null);
    }
  }

  // Cambiar estado de automatización o programar
  async function toggleAutomation(task: Task) {
    const newStatus = task.status === "scheduled" ? "pending" : "scheduled";
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", task.id);

    if (!error) {
      fetchTasks();
    } else {
      alert("Error al actualizar el modo de ejecución.");
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === "all") return true;
    return t.status === filterStatus;
  });

  if (!mounted) return null;

  return (
    <main className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"} px-6 py-12`}>
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Cabecera con botón de modo nocturno */}
        <div className="flex justify-between items-start">
          <div>
            <a
              href="/dashboard"
              className={`text-sm font-medium ${darkMode ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition`}
            >
              ← Volver al dashboard
            </a>
            <h1 className={`mt-4 text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
              Control de Tareas y Automatizaciones
            </h1>
            <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
              Supervisa pendientes, programa ejecuciones automáticas o dispara agentes manualmente.
            </p>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 ${
              darkMode 
                ? "bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800" 
                : "bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-xs"
            }`}
            title="Cambiar Modo Nocturno"
          >
            <span>{darkMode ? "☀️" : "🌙"}</span>
            <span className="hidden sm:inline">{darkMode ? "Modo Claro" : "Modo Nocturno"}</span>
          </button>
        </div>

        {/* Filtros rápidos */}
        <div className={`flex flex-wrap items-center gap-2 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-4 rounded-xl border shadow-sm`}>
          <span className={`text-xs font-semibold ${darkMode ? "text-slate-400" : "text-gray-500"} mr-2`}>Filtrar estado:</span>
          {["all", "pending", "scheduled", "completed", "transferred"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
                filterStatus === status 
                  ? (darkMode ? "bg-white text-slate-900" : "bg-gray-900 text-white") 
                  : (darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }`}
            >
              {status === "all" ? "Todas" : status}
            </button>
          ))}
          <button
            onClick={fetchTasks}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              darkMode ? "bg-blue-950/60 text-blue-300 hover:bg-blue-900/60 border border-blue-900/50" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            }`}
          >
            🔄 Actualizar lista
          </button>
        </div>

        {/* Listado de Tareas */}
        <div className={`rounded-2xl border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} shadow-sm overflow-hidden`}>
          <div className={`p-6 border-b ${darkMode ? "border-slate-800" : "border-gray-100"}`}>
            <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              Listado general ({filteredTasks.length})
            </h2>
          </div>

          {loading ? (
            <div className={`p-8 text-center text-sm ${darkMode ? "text-slate-500" : "text-gray-400"}`}>Cargando tareas...</div>
          ) : filteredTasks.length === 0 ? (
            <div className={`p-8 text-center text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
              No hay tareas registradas con este filtro.
            </div>
          ) : (
            <div className={`divide-y ${darkMode ? "divide-slate-800" : "divide-gray-100"}`}>
              {filteredTasks.map((task) => {
                const employeeInfo = Array.isArray(task.employees) ? task.employees[0] : task.employees;
                const isExecuting = executingId === task.id;

                return (
                  <div key={task.id} className={`p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${darkMode ? "hover:bg-slate-800/50" : "hover:bg-gray-50/50"}`}>
                    <div className="space-y-1.5 max-w-2xl">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${
                          task.status === "completed" 
                            ? (darkMode ? "bg-green-950 text-green-300 border border-green-900" : "bg-green-100 text-green-800") :
                          task.status === "scheduled" 
                            ? (darkMode ? "bg-purple-950 text-purple-300 border border-purple-900" : "bg-purple-100 text-purple-800") :
                          task.status === "transferred" 
                            ? (darkMode ? "bg-amber-950 text-amber-300 border border-amber-900" : "bg-amber-100 text-amber-800") :
                            (darkMode ? "bg-blue-950 text-blue-300 border border-blue-900" : "bg-blue-100 text-blue-800")
                        }`}>
                          {task.status}
                        </span>
                        <h3 className={`text-sm font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{task.title}</h3>
                      </div>
                      <p className={`text-xs ${darkMode ? "text-slate-300" : "text-gray-600"}`}>{task.description || "Sin descripción detallada."}</p>
                      <div className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"} flex gap-2 flex-wrap`}>
                        <span>Asignado a: <strong className={darkMode ? "text-slate-200" : "text-gray-700"}>{employeeInfo?.name || "Agente"}</strong> ({employeeInfo?.role || "Sin rol"})</span>
                        <span>•</span>
                        <span>Creado: {new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Botones de Acción Manual / Automática */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={() => toggleAutomation(task)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                          task.status === "scheduled" 
                            ? (darkMode ? "bg-purple-950/60 border-purple-800 text-purple-300 hover:bg-purple-900" : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100") 
                            : (darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100")
                        }`}
                        title="Alternar entre modo pendiente y programado automático"
                      >
                        {task.status === "scheduled" ? "🤖 Automático Activo" : "⏰ Programar Auto"}
                      </button>

                      <button
                        disabled={isExecuting || task.status === "completed"}
                        onClick={() => handleManualExecution(task)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          task.status === "completed"
                            ? (darkMode ? "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed" : "bg-gray-300 text-gray-600 cursor-not-allowed")
                            : isExecuting
                            ? "bg-indigo-400 text-white cursor-wait"
                            : (darkMode ? "bg-white text-slate-900 hover:bg-slate-200 shadow-sm" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm")
                        }`}
                      >
                        {isExecuting ? "Ejecutando..." : "▶️ Ejecutar Manual"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}