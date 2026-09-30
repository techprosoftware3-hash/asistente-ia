"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/app/context/ThemeContext";
import { jsPDF } from "jspdf";

type FileItem = {
  id: string;
  title: string;
  file_type: "document" | "spreadsheet";
  content: string;
  created_at: string;
};

export default function FilesPage() {
  const router = useRouter();
  const supabase = createClient();
  const { darkMode, toggleDarkMode, mounted } = useTheme();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Mi Empresa / Oficina");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Obtener el nombre y el logo de la empresa del perfil del usuario
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, company_logo")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        if (profile.company_name) setCompanyName(profile.company_name);
        if (profile.company_logo) setCompanyLogo(profile.company_logo);
      }

      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFiles(data);
      }
      setLoading(false);
    }

    loadFiles();
  }, [supabase, router]);

  // Función para eliminar un archivo
  const handleDeleteFile = async (fileId: string, fileTitle: string) => {
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar "${fileTitle}"?`);
    if (!confirmDelete) return;

    setDeletingId(fileId);

    const { error } = await supabase
      .from("files")
      .delete()
      .eq("id", fileId);

    if (error) {
      alert("Hubo un error al intentar eliminar el archivo.");
      console.error(error);
    } else {
      setFiles((prevFiles) => prevFiles.filter((f) => f.id !== fileId));
    }

    setDeletingId(null);
  };

  // Función auxiliar para convertir la URL del logo a Base64 y evitar problemas de CORS en jsPDF
  const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("No se pudo cargar el logo de la empresa para el PDF:", error);
      return null;
    }
  };

  // Función para generar un PDF altamente profesional y corporativo
  const handleDownloadPDF = async (file: FileItem) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const printableWidth = pageWidth - margin * 2;

    // --- 1. CARGAR LOGO SI EXISTE ---
    let logoBase64: string | null = null;
    if (companyLogo) {
      logoBase64 = await getBase64ImageFromUrl(companyLogo);
    }

    // --- 2. ENCABEZADO CORPORATIVO (Barra superior de color) ---
    doc.setFillColor(15, 23, 42); // Gris pizarra muy oscuro / profesional
    doc.rect(0, 0, pageWidth, 35, "F");

    let textStartX = margin;

    // Si tenemos el logo en base64, lo dibujamos en la barra superior
    if (logoBase64) {
      try {
        // Formato predeterminado PNG (o ajusta según tu imagen)
        doc.addImage(logoBase64, "PNG", margin, 7, 22, 21);
        textStartX = margin + 26; // Desplazamos el texto para que no se superponga con el logo
      } catch (err) {
        console.error("Error al incrustar el logo en el PDF:", err);
      }
    }

    // Título / Nombre de la empresa en la barra superior
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.text(companyName.toUpperCase(), textStartX, 22);

    // Subtítulo / Fecha de emisión en la barra (alineado a la derecha)
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    const dateStr = `Emitido: ${new Date(file.created_at).toLocaleDateString("es-AR")}`;
    doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 22);

    // --- 3. TÍTULO DEL DOCUMENTO ---
    let currentY = 50;
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    const cleanTitle = file.title.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
    doc.text(cleanTitle.toUpperCase(), margin, currentY);

    // Línea divisoria decorativa
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // --- 4. PROCESAMIENTO Y LIMPIEZA DE CONTENIDO ---
    currentY += 12;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);

    const formattedContent = file.content
      .replace(/\\n/g, "\n")
      .replace(/#/g, "")
      .replace(/\*\*/g, "");

    const paragraphs = formattedContent.split("\n");

    paragraphs.forEach((para) => {
      if (!para.trim()) {
        currentY += 4;
        return;
      }

      const isBullet = para.trim().startsWith("-") || para.trim().startsWith("•");
      const textToPrint = isBullet ? `  • ${para.replace(/^[-•]\s*/, "")}` : para;

      const splitText = doc.splitTextToSize(textToPrint, printableWidth);
      
      if (currentY + (splitText.length * 6) > 270) {
        doc.addPage();
        currentY = 25;
      }

      doc.text(splitText, margin, currentY);
      currentY += splitText.length * 6 + 2;
    });

    // --- 5. PIE DE PÁGINA PROFESIONAL ---
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Documento generado por ${companyName} - Página ${i} de ${pageCount}`,
        pageWidth / 2,
        285,
        { align: "center" }
      );
    }

    const fileName = file.title.endsWith(".pdf") ? file.title : `${file.title.replace(/\.[^/.]+$/, "")}.pdf`;
    doc.save(fileName);
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gradient-to-br from-gray-50 via-gray-50/50 to-gray-100/50 text-gray-900"} p-4 sm:p-8`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Cabecera */}
        <div className={`flex items-start sm:items-center justify-between gap-3 ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-4 sm:p-6 rounded-3xl border shadow-sm`}>
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className={`text-xs font-semibold ${darkMode ? "text-blue-400 hover:underline" : "text-indigo-600 hover:underline"} mb-1 block cursor-pointer`}
            >
              ← Volver al Panel
            </button>
            <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>Mis Archivos</h1>
            <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>Historial de presupuestos, informes y planillas generadas para {companyName}.</p>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 ${
              darkMode 
                ? "bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700" 
                : "bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-xs"
            }`}
            title="Cambiar Modo Nocturno"
          >
            <span>{darkMode ? "☀️" : "🌙"}</span>
            <span className="hidden sm:inline">{darkMode ? "Modo Claro" : "Modo Nocturno"}</span>
          </button>
        </div>

        {/* Listado de archivos */}
        {loading ? (
          <div className={`${darkMode ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-white border-gray-200 text-gray-400"} p-12 rounded-2xl border text-center text-sm shadow-sm`}>
            Cargando documentos...
          </div>
        ) : files.length === 0 ? (
          <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-300"} p-12 rounded-2xl border border-dashed text-center shadow-sm`}>
            <h3 className={`text-base font-semibold ${darkMode ? "text-white" : "text-gray-800"}`}>No hay archivos guardados</h3>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"} mt-1`}>Chatea con tu empleado para generar presupuestos o planillas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {files.map((file) => {
              const displayTitle = file.title.endsWith(".pdf") ? file.title : `${file.title.replace(/\.[^/.]+$/, "")}.pdf`;
              
              return (
                <div key={file.id} className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-4 sm:p-6 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">📑</span>
                      <h3 className={`font-bold break-words ${darkMode ? "text-white" : "text-gray-900"}`}>{displayTitle}</h3>
                      <span className={`text-[10px] font-semibold ${darkMode ? "bg-red-950/50 text-red-300 border border-red-900/50" : "bg-red-50 text-red-600"} px-2 py-0.5 rounded-full uppercase`}>
                        PDF Corporativo
                      </span>
                    </div>
                    <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-400"}`}>
                      Generado el {new Date(file.created_at).toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPDF(file)}
                      className={`inline-flex items-center gap-2 ${darkMode ? "bg-white text-slate-900 hover:bg-slate-200" : "bg-black text-white hover:bg-gray-800"} px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer`}
                    >
                      📥 Descargar PDF
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file.id, displayTitle)}
                      disabled={deletingId === file.id}
                      className={`inline-flex items-center gap-1 ${darkMode ? "bg-red-950/40 text-red-300 border-red-900 hover:bg-red-900/50" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"} border px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer`}
                      title="Eliminar archivo"
                    >
                      {deletingId === file.id ? "Eliminando..." : "🗑️"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}