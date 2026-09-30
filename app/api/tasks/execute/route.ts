import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No estás autenticado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const taskId = body.taskId;

    if (!taskId) {
      return NextResponse.json(
        { error: "Falta el taskId." },
        { status: 400 }
      );
    }

    // Buscar la tarea
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: "Tarea no encontrada." },
        { status: 404 }
      );
    }

    // Verificar que el empleado pertenezca al usuario
    const { data: employee, error: employeeError } =
      await supabase
        .from("employees")
        .select("*")
        .eq("id", task.employee_id)
        .eq("user_id", user.id)
        .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Empleado no encontrado." },
        { status: 404 }
      );
    }

    // Marcar tarea como ejecutándose
    const { error: runningError } = await supabase
      .from("tasks")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (runningError) {
      console.error(
        "Error marcando tarea como running:",
        runningError
      );
    }

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

Tu trabajo ahora es ejecutar una tarea.

Analizá la tarea y realizá el trabajo que puedas hacer con la información disponible.

IMPORTANTE:
- No inventes información.
- No afirmes haber realizado acciones externas que no realizaste.
- Si la tarea requiere una herramienta externa que todavía no existe, explicá qué debería hacerse.
- Producí un resultado útil y concreto.
- No hables como un chatbot genérico.
- Respondé como el empleado.
`;

    const response = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "openai/gpt-5.6",
      max_tokens: 1000,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `
TAREA:
${task.title}

DESCRIPCIÓN:
${task.description || "Sin descripción."}

Ejecutá esta tarea y devolvé el resultado.
`,
        },
      ],
    });

    const result = response.choices[0]?.message?.content;

    if (!result) {
      throw new Error(
        "OpenRouter no devolvió un resultado."
      );
    }

    // Guardar resultado
    const { data: updatedTask, error: updateError } =
      await supabase
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
      console.error(
        "Error actualizando tarea:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            "La tarea se ejecutó pero no se pudo guardar el resultado.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task: updatedTask,
      result,
    });
  } catch (error) {
    console.error(
      "Error ejecutando tarea:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}