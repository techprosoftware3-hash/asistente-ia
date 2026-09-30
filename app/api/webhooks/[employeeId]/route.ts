import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const supabase = createAdminClient();
  const resolvedParams = await params;
  const employeeId = resolvedParams.employeeId;

  try {
    // 1. Validar que el empleado exista
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, name, user_id")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "El empleado especificado no existe." },
        { status: 404 }
      );
    }

    // 2. Leer el cuerpo de la petición (payload del webhook)
    const body = await request.json().catch(() => ({}));

    const title = body.title || `Evento externo recibido vía Webhook`;
    const description = body.description 
      ? `${body.description}\n\nPayload completo:\n${JSON.stringify(body, null, 2)}`
      : `Datos recibidos del evento externo:\n${JSON.stringify(body, null, 2)}`;

    // 3. Crear la tarea automatizada para que el agente la ejecute
    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        employee_id: employeeId,
        title,
        description,
        status: "pending",
        is_automated: true,
        frequency: "once",
        next_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Error al crear la tarea automática: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Webhook recibido exitosamente y tarea asignada a ${employee.name}.`,
      task_id: newTask.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error procesando el webhook." },
      { status: 500 }
    );
  }
}