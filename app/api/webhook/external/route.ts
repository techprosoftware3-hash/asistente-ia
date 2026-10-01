import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializamos un cliente de Supabase para el servidor
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials are not configured");
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    
    const body = await request.json();
    const { employeeId, message, sender } = body;

    if (!employeeId || !message) {
      return NextResponse.json({ error: "Faltan parámetros (employeeId o message)" }, { status: 400 });
    }

    // 1. Obtener la información y el rol del agente (HASSAN)
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
    }

    // 2. Obtener las memorias o conocimiento global si es necesario
    const { data: memories } = await supabase
      .from("employee_memories")
      .select("memory")
      .eq("employee_id", employeeId);

    // 3. Aquí puedes integrar la llamada a tu servicio de IA (OpenAI, Anthropic, etc.) 
    // usando la personalidad del empleado y sus memorias para generar la respuesta.
    
    // Simulación de respuesta de la IA basada en el rol de HASSAN:
    const aiResponse = `Hola ${sender || "usuario"}, soy ${employee.name} (${employee.role}). He recibido tu mensaje: "${message}". ¿En qué te puedo ayudar hoy?`;

    // Opcional: Guardar el mensaje en el historial de chat si manejas una tabla de mensajes
    // await supabase.from("chats").insert({ employee_id: employeeId, message, response: aiResponse });

    return NextResponse.json({ 
      success: true, 
      employee: employee.name,
      response: aiResponse 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}