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
    const { employeeId, email } = body;

    if (!employeeId || !email) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (employeeId o email)." },
        { status: 400 }
      );
    }

    // 1. Verificar que el empleado pertenezca al usuario actual (dueño)
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "No tienes permiso para compartir este empleado o no existe." },
        { status: 403 }
      );
    }

    // 2. Insertar el registro en employee_shares
    const { error: shareError } = await supabase
      .from("employee_shares")
      .insert({
        employee_id: employeeId,
        shared_with_email: email.trim().toLowerCase(),
      });

    if (shareError) {
      // Si ya está compartido con ese correo, Supabase puede devolver error de duplicado (ej. código 23505)
      if (shareError.code === "23505") {
        return NextResponse.json(
          { error: "Este empleado ya está compartido con ese correo." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: shareError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Empleado compartido exitosamente." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ocurrió un error desconocido." },
      { status: 500 }
    );
  }
}