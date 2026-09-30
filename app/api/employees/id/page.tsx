import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Chat from "@/components/Chat";
import MemoryBox from "@/components/MemoryBox";
import TaskBox from "@/components/TaskBox";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EmployeePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !employee) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Volver */}
        <div className="mb-8">
          <a
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            ← Volver al dashboard
          </a>
        </div>

        {/* Información principal */}
        <div className="rounded-3xl border bg-white p-8 shadow-sm">
          <div className="mb-8">
            <div className="mb-4 inline-flex rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
              ● Empleado activo
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {employee.name}
            </h1>

            <p className="mt-2 text-lg text-gray-500">
              {employee.role}
            </p>
          </div>

          {/* Objetivo */}
          <section className="mb-6 rounded-2xl bg-gray-50 p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Objetivo
            </h2>

            <p className="text-gray-900">
              {employee.objective}
            </p>
          </section>

          {/* Personalidad */}
          <section className="mb-6 rounded-2xl border p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              Personalidad
            </h2>

            <p className="whitespace-pre-wrap text-gray-600">
              {employee.personality || "No especificada."}
            </p>
          </section>

          {/* Instrucciones */}
          <section className="mb-6 rounded-2xl border p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              Instrucciones
            </h2>

            <p className="whitespace-pre-wrap text-gray-600">
              {employee.instructions || "No especificadas."}
            </p>
          </section>

          {/* Reglas */}
          <section className="mb-6 rounded-2xl border p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Reglas
            </h2>

            {Array.isArray(employee.rules) &&
            employee.rules.length > 0 ? (
              <ul className="space-y-2">
                {employee.rules.map(
                  (rule: string, index: number) => (
                    <li
                      key={index}
                      className="rounded-xl bg-gray-50 p-3 text-gray-700"
                    >
                      {rule}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-gray-500">
                No hay reglas configuradas.
              </p>
            )}
          </section>

          {/* Herramientas */}
          <section className="mb-6 rounded-2xl border p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Herramientas
            </h2>

            {Array.isArray(employee.tools) &&
            employee.tools.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {employee.tools.map(
                  (tool: string, index: number) => (
                    <span
                      key={index}
                      className="rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-700"
                    >
                      {tool}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-gray-500">
                No hay herramientas configuradas.
              </p>
            )}
          </section>

          {/* Memoria */}
          <MemoryBox employeeId={employee.id} />
            <TaskBox employeeId={employee.id} />
          {/* Chat */}
          <Chat employeeId={employee.id} />
        </div>
      </div>
    </main>
  );
}