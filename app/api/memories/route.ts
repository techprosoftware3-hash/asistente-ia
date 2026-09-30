import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const content = body.content;
    const type = body.type || "general";

    if (!employeeId || !content) {
      return NextResponse.json(
        { error: "Faltan datos." },
        { status: 400 }
      );
    }

    // Verificar que el empleado pertenece al usuario
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

    // Guardar memoria
    const { data: memory, error } = await supabase
      .from("memories")
      .insert({
        employee_id: employeeId,
        content: content.trim(),
        type,
      })
      .select()
      .single();

    if (error) {
      console.error("Error guardando memoria:", error);

      return NextResponse.json(
        {
          error: "No se pudo guardar la memoria.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      memory,
    });
  } catch (error) {
    console.error("Error en /api/memories:", error);

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