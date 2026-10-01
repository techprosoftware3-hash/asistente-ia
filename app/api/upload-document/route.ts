import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Supabase key is not configured");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key);
};

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const employeeId = formData.get("employeeId") as string;

    if (!file || !employeeId) {
      return NextResponse.json(
        { error: "Faltan datos requeridos (archivo o employeeId)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split(".").pop() || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `${employeeId}/${fileName}`;

    // 1. Subir el archivo al bucket PRIVADO 'employee-files'
    const { error: uploadError } = await supabaseAdmin.storage
      .from("employee-files")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error al subir a Supabase Storage:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 2. Obtener el origen de la petición (ej. http://localhost:3000) de forma dinámica y segura
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const safeFileUrl = `${origin}/api/files/download?path=${encodeURIComponent(filePath)}`;

    // 3. Guardar el registro en la tabla employee_documents
    const { data: docData, error: dbError } = await supabaseAdmin
      .from("employee_documents")
      .insert({
        employee_id: employeeId,
        title: file.name,
        file_url: safeFileUrl, // Se guarda la URL absoluta limpia
        file_type: fileExt,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error al guardar en base de datos:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: docData,
    });
  } catch (err: any) {
    console.error("Error general en upload-document:", err);
    return NextResponse.json(
      { error: err.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}