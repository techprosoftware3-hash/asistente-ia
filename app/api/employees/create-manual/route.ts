import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No estás autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, role, objective, personality, instructions, rules, tools } = body;

    if (!name || !role) {
      return NextResponse.json({ error: "El nombre y el rol son obligatorios." }, { status: 400 });
    }

    const { data, error } = await supabase
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

    return NextResponse.json({ employee: data });
  } catch (error) {
    console.error("Error general en alta manual:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido." },
      { status: 500 }
    );
  }
}