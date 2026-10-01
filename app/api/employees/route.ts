import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmployee } from "@/lib/ai";
import { checkUserSubscription } from "@/lib/utils/subscription";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No estás autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    // Verificar límite de asistentes para acciones de creación
    if (action === "create-manual" || action === "generate") {
      const subscription = await checkUserSubscription(user.id);
      
      if (!subscription.isActive) {
        return NextResponse.json({ 
          error: "Tu suscripción no está activa. Por favor, suscríbete para crear asistentes." 
        }, { status: 403 });
      }

      // Contar asistentes actuales del usuario
      const { count: currentCount } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Verificar si excede el límite
      if (currentCount !== null && currentCount >= subscription.employeeLimit) {
        const limitText = subscription.employeeLimit === Infinity 
          ? "ilimitados" 
          : `máximo ${subscription.employeeLimit}`;
        
        return NextResponse.json({ 
          error: `Has alcanzado el límite de asistentes (${limitText}). Actualiza tu plan para crear más.` 
        }, { status: 403 });
      }
    }

    switch (action) {
      case "create-manual": {
        const { name, role, objective, personality, instructions, rules, tools } = data;

        if (!name || !role) {
          return NextResponse.json({ error: "El nombre y el rol son obligatorios." }, { status: 400 });
        }

        const { data: newEmp, error } = await supabase
          .from("employees")
          .insert({
            user_id: user.id,
            name,
            role,
            objective: objective || "",
            personality: personality || "",
            instructions: instructions || `Sos ${name}, ${role}.`,
            rules: rules || "",
            tools: tools || [],
          })
          .select()
          .single();

        if (error) {
          console.error("Error al insertar empleado manual en Supabase:", error);
          return NextResponse.json({ error: "No se pudo guardar el empleado.", details: error.message }, { status: 500 });
        }

        return NextResponse.json({ employee: newEmp });
      }

      case "generate": {
        const { description } = data;

        if (!description || typeof description !== "string") {
          return NextResponse.json({ error: "Falta la descripción del empleado." }, { status: 400 });
        }

        const aiResult = await generateEmployee(description);
        let employee;

        try {
          employee = JSON.parse(aiResult);
        } catch {
          return NextResponse.json({ error: "La IA devolvió un JSON inválido.", raw: aiResult }, { status: 500 });
        }

        const { data: genEmp, error } = await supabase
          .from("employees")
          .insert({
            user_id: user.id,
            name: employee.name,
            role: employee.role,
            objective: employee.objective,
            personality: employee.personality,
            instructions: employee.instructions,
            rules: employee.rules,
            tools: employee.tools,
          })
          .select()
          .single();

        if (error) {
          console.error("Error Supabase:", error);
          return NextResponse.json({ error: "No se pudo guardar el empleado.", details: error.message }, { status: 500 });
        }

        return NextResponse.json({ employee: genEmp });
      }

      case "update": {
        const { id, name, role, objective, personality, instructions, rules } = data;

        if (!id) {
          return NextResponse.json({ error: "Falta el ID del empleado" }, { status: 400 });
        }

        const { error } = await supabase
          .from("employees")
          .update({
            name,
            role,
            objective,
            personality,
            instructions,
            rules,
            updated_at: new Date().toISOString()
          })
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: "Empleado actualizado correctamente" });
      }

      case "share": {
        const { employeeId, email } = data;

        if (!employeeId || !email) {
          return NextResponse.json({ error: "Faltan datos requeridos (employeeId o email)." }, { status: 400 });
        }

        const { data: employee, error: empError } = await supabase
          .from("employees")
          .select("id")
          .eq("id", employeeId)
          .eq("user_id", user.id)
          .single();

        if (empError || !employee) {
          return NextResponse.json({ error: "No tienes permiso para compartir este empleado o no existe." }, { status: 403 });
        }

        const { error: shareError } = await supabase
          .from("employee_shares")
          .insert({
            employee_id: employeeId,
            shared_with_email: email.trim().toLowerCase(),
          });

        if (shareError) {
          if (shareError.code === "23505") {
            return NextResponse.json({ error: "Este empleado ya está compartido con ese correo." }, { status: 400 });
          }
          return NextResponse.json({ error: shareError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Empleado compartido exitosamente." });
      }

      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error general:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  
  return NextResponse.json({ message: `Datos del empleado ${id}` });
}