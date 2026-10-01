import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col justify-center overflow-x-hidden relative">
      
      {/* Luces ambientales difusas de fondo */}
      <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-gradient-to-br from-indigo-100/50 via-purple-100/30 to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-100/40 via-blue-50/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      <section className="mx-auto flex max-w-[92rem] flex-col justify-center px-5 sm:px-12 py-10 lg:py-4 w-full relative z-10">

        {/* Primera sección dividida en 2 columnas con mayor ancho */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Columna de Texto */}
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-medium text-emerald-800 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              AI Asistente de Trabajo
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-slate-900 leading-tight">
              Creá tu propio
              <br />
              <span className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 bg-clip-text text-transparent">
                asistente de trabajo de IA.
              </span>
            </h1>

            <p className="max-w-2xl text-base sm:text-xl leading-relaxed text-slate-600">
              Decile qué trabajo querés que haga.
              Nuestra plataforma construye un empleado
              digital preparado para ayudarte.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
              {/* Botón principal sólido con resplandor elegante */}
              <Link
                href="/login"
                className="relative inline-flex items-center justify-center rounded-2xl bg-black px-6 py-3.5 sm:px-7 sm:py-4 font-medium text-white transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(0,0,0,0.2)] hover:shadow-[0_0_30px_rgba(0,0,0,0.4)] text-base"
              >
                <span className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/30 to-blue-500/30 blur-sm opacity-75 animate-pulse -z-10"></span>
                Crear mi asistente de trabajo
              </Link>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-xs px-6 py-3.5 sm:px-7 sm:py-4 font-medium transition-all duration-300 hover:bg-slate-50 hover:scale-105 text-slate-800 text-base flex items-center justify-center shadow-2xs"
              >
                Ver dashboard
              </Link>
            </div>
          </div>

          {/* Columna de Imagen completamente integrada sin recuadros */}
          <div className="lg:col-span-5 flex justify-center overflow-hidden relative">
            <div 
              className="w-full h-[220px] sm:h-[400px] bg-cover bg-center animate-zoom-pulse"
              style={{
                backgroundImage: `url('https://plus.unsplash.com/premium_photo-1676637656166-cb7b3a43b81a?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')`,
                WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
                maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
                mixBlendMode: 'multiply'
              }}
            />
          </div>

        </div>

        {/* Tarjetas inferiores distribuidas en todo el ancho */}
        <div className="mt-8 lg:mt-10 grid gap-4 sm:gap-6 md:grid-cols-3">

          <div className="rounded-3xl border border-slate-200/80 p-5 bg-white/90 backdrop-blur-xs shadow-2xs hover:shadow-md transition">
            <div className="text-2xl p-2.5 bg-slate-50 w-fit rounded-2xl border border-slate-100">🧠</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              Inteligente
            </h2>
            <p className="mt-1 text-slate-600 text-sm leading-relaxed">
              Definí el trabajo y la IA crea
              las instrucciones del empleado.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 p-5 bg-white/90 backdrop-blur-xs shadow-2xs hover:shadow-md transition">
            <div className="text-2xl p-2.5 bg-slate-50 w-fit rounded-2xl border border-slate-100">⚙️</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              Personalizable
            </h2>
            <p className="mt-1 text-slate-600 text-sm leading-relaxed">
              Cada asistente de trabajo tiene su propio
              objetivo, personalidad y reglas.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 p-5 bg-white/90 backdrop-blur-xs shadow-2xs hover:shadow-md transition">
            <div className="text-2xl p-2.5 bg-slate-50 w-fit rounded-2xl border border-slate-100">🚀</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              Preparado para trabajar
            </h2>
            <p className="mt-1 text-slate-600 text-sm leading-relaxed">
              Más adelante podrá utilizar
              herramientas y ejecutar tareas.
            </p>
          </div>

        </div>

      </section>

      {/* Pie de página con enlaces legales */}
      <footer className="border-t border-slate-200/80 text-center text-xs flex flex-wrap justify-center gap-x-6 gap-y-2 px-5 py-6">
        <span className="text-slate-400">© 2026 miasistentelab.com - Todos los derechos reservados</span>
        <span className="text-slate-300">•</span>
        <Link
          href="/terms"
          className="text-slate-400 hover:underline transition-colors"
        >
          Términos y Condiciones
        </Link>
        <span className="text-slate-300">•</span>
        <Link
          href="/privacy"
          className="text-slate-400 hover:underline transition-colors"
        >
          Política de Privacidad
        </Link>
        <span className="text-slate-300">•</span>
        <a
          href="mailto:miasistentelab@gmail.com?subject=Contacto%20%2F%20Reclamo"
          className="text-slate-400 hover:underline transition-colors break-all"
        >
          Contacto y reclamos: miasistentelab@gmail.com
        </a>
      </footer>
    </main>
  );
}