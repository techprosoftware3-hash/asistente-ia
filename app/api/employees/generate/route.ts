import { NextResponse } from "next/server";
import { generateEmployee } from "@/lib/ai";
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
    const description = body.description;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Falta la descripción del empleado." },
        { status: 400 }
      );
    }

    const aiResult = await generateEmployee(description);

    console.log("Respuesta de OpenAI:", aiResult);

    let employee;

    try {
      employee = JSON.parse(aiResult);
    } catch {
      return NextResponse.json(
        {
          error: "La IA devolvió un JSON inválido.",
          raw: aiResult,
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
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

      return NextResponse.json(
        {
          error: "No se pudo guardar el empleado.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      employee: data,
    });
  } catch (error) {
    console.error("Error general:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error desconocido.",
      },
      { status: 500 }
    );
  }
}