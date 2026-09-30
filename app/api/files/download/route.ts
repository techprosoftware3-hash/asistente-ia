import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: "Ruta de archivo no especificada" }, { status: 400 });
    }

    // 1. Descargar el archivo directamente desde el bucket privado de Supabase
    const { data, error } = await supabaseAdmin.storage
      .from("employee-files")
      .download(filePath);

    if (error || !data) {
      console.error("Error al descargar desde Supabase:", error);
      return NextResponse.json({ error: "Archivo no encontrado o sin permisos" }, { status: 404 });
    }

    // 2. Obtener los bytes del archivo
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Determinar el tipo MIME basándose en la extensión
    const ext = filePath.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "png") contentType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";

    // 4. Retornar el archivo de forma segura al navegador
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filePath.split("/").pop()}"`,
      },
    });
  } catch (err: any) {
    console.error("Error en /api/files/download:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}