"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext";

export default function TermsPage() {
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
            <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>Términos y Condiciones</h1>
            <p className={`text-xs ${darkMode ? "text-slate-400" : "text-gray-500"} mt-1`}>Última actualización: marzo de 2026</p>
          </div>

          <div className={`space-y-6 text-sm ${darkMode ? "text-slate-300" : "text-gray-600"} leading-relaxed`}>
            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>1. Aceptación de los términos</h2>
              <p>
                Al utilizar Autonomous Workforce OS y nuestros servicios de asistentes virtuales, usted acepta cumplir y estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar la plataforma.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>2. Descripción del servicio</h2>
              <p>
                Proporcionamos una plataforma basada en Inteligencia Artificial para la automatización de flotas, tareas administrativas, gestión de empleados virtuales, organización corporativa y generación automática de documentos y reportes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>3. Cuentas, Suscripciones y Periodo de Prueba</h2>
              <p>
                El uso del servicio requiere registro previo. Las cuentas disponen de un periodo de prueba o planes de suscripción vigentes. El incumplimiento en los pagos o la finalización de los periodos de prueba sin renovación trasladará la cuenta a un modo de solo lectura hasta regularizar su situación.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>4. Uso aceptable y responsabilidades</h2>
              <p>
                Usted se compromete a no utilizar la plataforma para actividades ilícitas, fraudulentas o que vulneren la seguridad de los sistemas informáticos. Las decisiones operativas tomadas a partir de la ejecución de los agentes virtuales son de entera responsabilidad del usuario.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>5. Ley aplicable y jurisdicción</h2>
              <p>
                Estos términos se rigen e interpretan de acuerdo con las leyes de la República Argentina. Cualquier controversia será sometida a los tribunales ordinarios competentes.
              </p>
            </section>
          </div>

          <div className={`pt-6 border-t ${darkMode ? "border-slate-800" : "border-gray-100"} flex flex-col sm:flex-row justify-between items-center gap-4 text-xs`}>
            <span className={darkMode ? "text-slate-500" : "text-gray-400"}>© 2026 miasistentelab.com · Todos los derechos reservados</span>
            <button 
              onClick={() => router.push("/privacy")}
              className={`underline font-medium ${darkMode ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"} cursor-pointer`}
            >
              Ver Política de Privacidad →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}