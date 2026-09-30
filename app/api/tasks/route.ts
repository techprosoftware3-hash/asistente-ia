import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_FREQUENCIES = [
  "once",
  "daily",
  "weekly",
] as const;

type Frequency = (typeof VALID_FREQUENCIES)[number];

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "Falta el employeeId." },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } =
      await supabase
        .from("employees")
        .select("id")
        .eq("id", employeeId)
        .eq("user_id", user.id)
        .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Empleado no encontrado." },
        { status: 404 }
      );
    }

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, result, started_at, completed_at, created_at, updated_at, is_automated, scheduled_at, last_run_at, frequency, next_run_at"
      )
      .eq("employee_id", employeeId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Error obteniendo tareas:",
        error
      );

      return NextResponse.json(
        {
          error: "No se pudieron obtener las tareas.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tasks: tasks ?? [],
    });
  } catch (error) {
    console.error(
      "Error general obteniendo tareas:",
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

    const employeeId = body.employeeId;
    const title = body.title;
    const description = body.description || "";
    const isAutomated = Boolean(body.isAutomated);
    const scheduledAt = body.scheduledAt || null;

    const frequency: Frequency =
      VALID_FREQUENCIES.includes(body.frequency)
        ? body.frequency
        : "once";

    if (!employeeId) {
      return NextResponse.json(
        { error: "Falta el employeeId." },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Falta el título de la tarea." },
        { status: 400 }
      );
    }

    if (!title.trim()) {
      return NextResponse.json(
        { error: "El título no puede estar vacío." },
        { status: 400 }
      );
    }

    if (isAutomated && !scheduledAt) {
      return NextResponse.json(
        {
          error:
            "Las tareas automáticas necesitan una fecha programada.",
        },
        { status: 400 }
      );
    }

    if (!isAutomated && frequency !== "once") {
      return NextResponse.json(
        {
          error:
            "Las tareas recurrentes deben ser automáticas.",
        },
        { status: 400 }
      );
    }

    if (!isAutomated && scheduledAt) {
      return NextResponse.json(
        {
          error:
            "Una tarea manual no puede tener una fecha automática.",
        },
        { status: 400 }
      );
    }

    const { data: employee, error: employeeError } =
      await supabase
        .from("employees")
        .select("id")
        .eq("id", employeeId)
        .eq("user_id", user.id)
        .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Empleado no encontrado." },
        { status: 404 }
      );
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        employee_id: employeeId,
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim()
            : "",
        status: "pending",
        is_automated: isAutomated,
        scheduled_at: isAutomated
          ? scheduledAt
          : null,
        frequency: isAutomated
          ? frequency
          : "once",
        next_run_at: isAutomated
          ? scheduledAt
          : null,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Error creando tarea:",
        error
      );

      return NextResponse.json(
        {
          error: "No se pudo crear la tarea.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task,
    });
  } catch (error) {
    console.error(
      "Error general creando tarea:",
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