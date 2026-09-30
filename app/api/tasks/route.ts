import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

const VALID_FREQUENCIES = ["once", "daily", "weekly"] as const;
type Frequency = (typeof VALID_FREQUENCIES)[number];

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No estás autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json({ error: "Falta el employeeId." }, { status: 400 });
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("user_id", user.id)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
    }

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, result, started_at, completed_at, created_at, updated_at, is_automated, scheduled_at, last_run_at, frequency, next_run_at"
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error obteniendo tareas:", error);
      return NextResponse.json({ error: "No se pudieron obtener las tareas.", details: error.message }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (error) {
    console.error("Error general obteniendo tareas:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No estás autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || (body.taskId ? "execute" : "create");

    switch (action) {
      case "execute": {
        const { taskId } = body;

        if (!taskId) {
          return NextResponse.json({ error: "Falta el taskId." }, { status: 400 });
        }

        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .single();

        if (taskError || !task) {
          return NextResponse.json({ error: "Tarea no encontrada." }, { status: 404 });
        }

        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("*")
          .eq("id", task.employee_id)
          .eq("user_id", user.id)
          .single();

        if (employeeError || !employee) {
          return NextResponse.json({ error: "Empleado no encontrado o sin permisos." }, { status: 404 });
        }

        await supabase
          .from("tasks")
          .update({
            status: "running",
            started_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        const systemPrompt = `
Sos un empleado digital llamado ${employee.name}.

ROL:
${employee.role}

OBJETIVO:
${employee.objective}

PERSONALIDAD:
${employee.personality ?? ""}

INSTRUCCIONES:
${employee.instructions ?? ""}

REGLAS:
${JSON.stringify(employee.rules ?? [])}

Tu trabajo ahora es ejecutar una tarea. Analizá la tarea y realizá el trabajo que puedas hacer con la información disponible.

IMPORTANTE:
- No inventes información.
- No afirmes haber realizado acciones externas que no realizaste.
- Si la tarea requiere una herramienta externa que todavía no existe, explicá qué debería hacerse.
- Producí un resultado útil y concreto.
- No hables como un chatbot genérico.
- Respondé como el empleado.
`;

        const response = await openrouter.chat.completions.create({
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o",
          max_tokens: 1000,
          temperature: 0.5,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `TAREA:\n${task.title}\n\nDESCRIPCIÓN:\n${task.description || "Sin descripción."}\n\nEjecutá esta tarea y devolvé el resultado.`,
            },
          ],
        });

        const result = response.choices[0]?.message?.content;

        if (!result) {
          throw new Error("OpenRouter no devolvió un resultado.");
        }

        const { data: updatedTask, error: updateError } = await supabase
          .from("tasks")
          .update({
            status: "completed",
            result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json(
            { error: "La tarea se ejecutó pero no se pudo guardar el resultado.", details: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ task: updatedTask, result });
      }

      case "create":
      default: {
        const { employeeId, title, description = "", isAutomated = false, scheduledAt = null } = body;
        const frequency: Frequency = VALID_FREQUENCIES.includes(body.frequency) ? body.frequency : "once";

        if (!employeeId) {
          return NextResponse.json({ error: "Falta el employeeId." }, { status: 400 });
        }

        if (!title || typeof title !== "string" || !title.trim()) {
          return NextResponse.json({ error: "El título de la tarea es obligatorio y no puede estar vacío." }, { status: 400 });
        }

        if (isAutomated && !scheduledAt) {
          return NextResponse.json({ error: "Las tareas automáticas necesitan una fecha programada." }, { status: 400 });
        }

        if (!isAutomated && frequency !== "once") {
          return NextResponse.json({ error: "Las tareas recurrentes deben ser automáticas." }, { status: 400 });
        }

        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("id")
          .eq("id", employeeId)
          .eq("user_id", user.id)
          .single();

        if (employeeError || !employee) {
          return NextResponse.json({ error: "Empleado no encontrado." }, { status: 404 });
        }

        const { data: task, error } = await supabase
          .from("tasks")
          .insert({
            employee_id: employeeId,
            title: title.trim(),
            description: typeof description === "string" ? description.trim() : "",
            status: "pending",
            is_automated: isAutomated,
            scheduled_at: isAutomated ? scheduledAt : null,
            frequency: isAutomated ? frequency : "once",
            next_run_at: isAutomated ? scheduledAt : null,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creando tarea:", error);
          return NextResponse.json({ error: "No se pudo crear la tarea.", details: error.message }, { status: 500 });
        }

        return NextResponse.json({ task });
      }
    }
  } catch (error) {
    console.error("Error general en tasks API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }
}