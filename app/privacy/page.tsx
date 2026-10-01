"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext";

export default function PrivacyPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode, mounted } = useTheme();

  if (!mounted) return null;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"} p-4 sm:p-6 md:p-12`}>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Cabecera con botón de retorno y modo nocturno */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className={`text-sm font-medium ${darkMode ? "text-blue-400 hover:underline" : "text-blue-600 hover:underline"} transition cursor-pointer`}
          >
            ← Volver al Dashboard
          </button>

          <button
            onClick={toggleDarkMode}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 ${
              darkMode 
                ? "bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800" 
                : "bg-white hover:bg-gray-100 text-slate-700 border-gray-200 shadow-xs"
            }`}
            title="Cambiar Modo Nocturno"
          >
            <span>{darkMode ? "☀️" : "🌙"}</span>
            <span className="hidden sm:inline">{darkMode ? "Modo Claro" : "Modo Nocturno"}</span>
          </button>
        </div>

        <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-5 sm:p-8 md:p-10 rounded-3xl border shadow-sm space-y-6 transition-colors`}>
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>Política de Privacidad</h1>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"} mt-1`}>Última actualización: marzo de 2026</p>
          </div>

          <div className={`space-y-6 text-sm ${darkMode ? "text-slate-300" : "text-gray-600"} leading-relaxed`}>
            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>1. Información que recopilamos</h2>
              <p>
                Recopilamos la información estrictamente necesaria para el funcionamiento de los agentes autónomos y la gestión de tu perfil, incluyendo tu correo electrónico, configuraciones de empresa, registros de archivos generados y bases de conocimiento.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>2. Uso y protección de los datos</h2>
              <p>
                Los datos almacenados en nuestras bases de datos seguras se utilizan exclusivamente para proveer el servicio de asistencia virtual, generar reportes corporativos y ejecutar las tareas automatizadas solicitadas. Sus datos nunca son vendidos ni comercializados con terceros.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>3. Seguridad de la información</h2>
              <p>
                Implementamos estrictas medidas de seguridad técnicas y organizativas, tales como autenticación mediante tokens cifrados, aislamiento de datos por usuario (Row Level Security en Supabase) y conexiones seguras.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>4. Sus derechos sobre los datos</h2>
              <p>
                Usted conserva el derecho absoluto a acceder, modificar, rectificar o eliminar los datos de su cuenta y los archivos generados en cualquier momento directamente desde el panel de control o contactando al soporte técnico.
              </p>
            </section>
          </div>

          <div className={`pt-6 border-t ${darkMode ? "border-slate-800" : "border-gray-100"} flex flex-col sm:flex-row justify-between items-center gap-4 text-xs`}>
            <span className={darkMode ? "text-slate-500" : "text-gray-400"}>© 2026 miasistentelab.com · Todos los derechos reservados</span>
            <button 
              onClick={() => router.push("/terms")}
              className={`underline font-medium ${darkMode ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"} cursor-pointer`}
            >
              Ver Términos y Condiciones →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}