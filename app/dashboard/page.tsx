"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext";

export default function DashboardPage() {
  const { darkMode, toggleDarkMode, mounted } = useTheme();

  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  
  // Estados para la gestión de la empresa u oficina
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");

      const preApprovalId = new URLSearchParams(window.location.search).get("preapproval_id");
      if (preApprovalId) {
        await fetch(`/api/payment/webhook?preapproval_id=${encodeURIComponent(preApprovalId)}`).catch(() => null);
        router.replace("/dashboard");
      }

      // 1. Verificar el estado de la suscripción y obtener datos del perfil (nombre y logo)
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_end_date, company_name, company_logo")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const now = new Date();
        const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : now;
        const subEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;

        const isTrialActive = now < trialEndsAt;
        const isSubActive = profile.subscription_status === "active" && subEndDate && now < subEndDate;

        const active = Boolean(isTrialActive || isSubActive);
        setIsSubscriptionActive(active);

        if (!active) {
          const verification = await fetch("/api/payment/webhook")
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null);
          if (verification?.active) {
            setIsSubscriptionActive(true);
            router.refresh();
          }
        }
        
        if (profile.company_name) {
          setCompanyName(profile.company_name);
        }
        if (profile.company_logo) {
          setCompanyLogo(profile.company_logo);
        }
      }

      // 2. Obtener empleados propios
      const { data: ownedEmployees } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id);

      // 3. Obtener IDs de empleados compartidos
      let sharedEmployees: any[] = [];
      if (user.email) {
        const { data: shares } = await supabase
          .from("employee_shares")
          .select("employee_id")
          .eq("shared_with_email", user.email);

        if (shares && shares.length > 0) {
          const sharedIds = shares.map((s) => s.employee_id);
          const { data: fetchedShared } = await supabase
            .from("employees")
            .select("*")
            .in("id", sharedIds);

          if (fetchedShared) {
            sharedEmployees = fetchedShared.map(emp => ({ ...emp, isShared: true }));
          }
        }
      }

      const allEmployeesMap = new Map();
      ([...(ownedEmployees || []), ...sharedEmployees]).forEach(emp => {
        allEmployeesMap.set(emp.id, emp);
      });

      setEmployees(Array.from(allEmployeesMap.values()));
      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          company_name: companyName,
          company_logo: companyLogo 
        })
        .eq("id", user.id);

      if (error) {
        alert("Error al guardar los datos de la empresa: " + error.message);
      } else {
        setIsEditingCompany(false);
      }
    }
    setSavingCompany(false);
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-[#F8FAFC] text-slate-900"} selection:bg-blue-600 selection:text-white p-4 sm:p-6 md:p-10`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabecera Principal */}
        <header className={`${darkMode ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200/80"} backdrop-blur-md md:sticky md:top-6 z-20 border shadow-xs rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className={`text-xl sm:text-2xl font-extrabold break-words tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
                {companyName || "Mi Empresa / Oficina"}
              </h1>
              <button 
                onClick={() => setIsEditingCompany(!isEditingCompany)}
                className={`text-xs ${darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600"} px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer`}
                title="Editar nombre y logo de la empresa"
              >
                <span>✏️</span> {isEditingCompany ? "Cancelar" : "Editar Organización"}
              </button>
            </div>
            <p className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"} uppercase tracking-wider`}>
              Autonomous Workforce OS &bull; Panel de Control
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-between md:justify-end">
            <div className={`flex items-center gap-2 text-xs font-medium ${darkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200/60 text-slate-600"} border px-3.5 py-2 rounded-xl`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate max-w-[200px]">{userEmail}</span>
            </div>

            <button
              onClick={toggleDarkMode}
              className={`text-xs font-medium px-3.5 py-2 rounded-xl transition-all border cursor-pointer flex items-center gap-1.5 ${
                darkMode 
                  ? "bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"
              }`}
              title="Cambiar Modo Nocturno"
            >
              <span>{darkMode ? "☀️" : "🌙"}</span>
              <span className="hidden sm:inline">{darkMode ? "Modo Claro" : "Modo Nocturno"}</span>
            </button>

            <button
              onClick={() => router.push("/dashboard/upgrade")}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                darkMode ? "bg-slate-100 hover:bg-white text-slate-900" : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <span>💳</span> Suscripción
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/");
              }}
              className="text-xs text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Formulario desplegable para editar Nombre y Logo */}
        {isEditingCompany && (
          <form onSubmit={handleSaveCompany} className={`${darkMode ? "bg-slate-900 border-blue-900" : "bg-white border-blue-200/85"} border p-4 sm:p-6 rounded-2xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200`}>
            <div>
              <h3 className={`text-sm font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>🏢 Configurar Organización & Logo</h3>
              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"} mt-0.5`}>Personaliza el nombre y agrega el enlace directo al logo corporativo para tus reportes en PDF.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={`text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Nombre de la Empresa</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: Grupo Cargo o techPro"
                  className={`w-full ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600"} border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className={`text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Link del Logo (URL de imagen)</label>
                <input
                  type="url"
                  value={companyLogo}
                  onChange={(e) => setCompanyLogo(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className={`w-full ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:ring-blue-600"} border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all`}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingCompany}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {savingCompany ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        )}

        {/* Tarjeta informativa más compacta y estilizada */}
        <div className={`px-4 py-3 rounded-xl border flex items-center gap-3 transition-colors ${
          darkMode 
            ? "bg-indigo-950/30 border-indigo-900/60 text-indigo-200" 
            : "bg-indigo-50/80 border-indigo-100 text-indigo-900"
        }`}>
          <span className="text-xl shrink-0">🏖️</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
            <span className={`font-bold shrink-0 ${darkMode ? "text-indigo-200" : "text-indigo-950"}`}>
              Tranquilidad total:
            </span>
            <p className={`leading-relaxed ${darkMode ? "text-indigo-300/90" : "text-indigo-800"}`}>
              Agregá conocimientos a tu asistente y compartilo con tu colega. Si te vas de vacaciones, tu asistente ya sabrá todo para contestar las dudas de tus compañeros.
            </p>
          </div>
        </div>

        {/* Panel de Control Principal & Estadísticas (Compacto) */}
        <section className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"} border shadow-xs rounded-2xl p-4 md:p-5 space-y-4 transition-colors`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-0.5">
              <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-slate-900"} tracking-tight`}>Fuerza de Trabajo Autónoma</h2>
              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Crea nuevos asistentes para tu organización o para ti mismo, gestiona conocimiento global y tareas.</p>
            </div>
            
            {/* Barra de Navegación Rápida Compacta */}
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
              <button onClick={() => router.push("/dashboard/files")} className={`text-xs font-medium ${darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"} border px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer`}>
                📂 <span>Archivos</span>
              </button>
              <button onClick={() => router.push("/dashboard/knowledge")} className={`text-xs font-medium ${darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700" : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80"} border px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer`}>
                🌐 <span>Conocimiento</span>
              </button>
              <button onClick={() => router.push("/dashboard/tasks")} className={`text-xs font-medium ${darkMode ? "bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border-indigo-900" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200/80"} border px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer`}>
                📋 <span>Tareas & Auto</span>
              </button>
              
              <button 
                onClick={() => {
                  if (!isSubscriptionActive) {
                    alert("Tu periodo de prueba ha finalizado. La creación de nuevos asistentes está deshabilitada.");
                    return;
                  }
                  router.push("/dashboard/new");
                }} 
                className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-all shadow-xs whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSubscriptionActive 
                    ? "bg-blue-600 hover:bg-blue-700 text-white" 
                    : "bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
              >
                ➕ <span>Crear Asistente</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Reducidas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className={`${darkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50/70 border-slate-200/60"} border p-3.5 rounded-xl flex items-center justify-between transition-colors`}>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total asistentes</p>
                <p className={`text-xl font-extrabold ${darkMode ? "text-white" : "text-slate-900"}`}>{employees.length}</p>
              </div>
              <p className={`text-[11px] text-right ${darkMode ? "text-slate-400" : "text-slate-500"} max-w-[120px]`}>Agentes configurados o compartidos</p>
            </div>
            
            <div className={`${darkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50/70 border-slate-200/60"} border p-3.5 rounded-xl flex items-center justify-between transition-colors`}>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agentes Activos</p>
                <p className="text-xl font-extrabold text-blue-500">{employees.length}</p>
              </div>
              <p className={`text-[11px] text-right ${darkMode ? "text-slate-400" : "text-slate-500"} max-w-[120px]`}>Listos para despachar tareas</p>
            </div>

            <div className={`${darkMode ? "bg-slate-800/50 border-slate-700/50" : "bg-slate-50/70 border-slate-200/60"} border p-3.5 rounded-xl flex items-center justify-between transition-colors`}>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado del Sistema</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isSubscriptionActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                  <span className={`font-bold ${darkMode ? "text-white" : "text-slate-900"} text-xs`}>{isSubscriptionActive ? "Online" : "Solo Lectura"}</span>
                </div>
              </div>
              <p className={`text-[11px] text-right ${darkMode ? "text-slate-400" : "text-slate-500"} max-w-[120px]`}>{isSubscriptionActive ? "Supabase operativo" : "Prueba vencida"}</p>
            </div>
          </div>
        </section>

        {/* Listado de Empleados */}
        <section className="space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 px-1">
            <h2 className={`text-base font-bold ${darkMode ? "text-white" : "text-slate-900"} tracking-tight`}>Asistentes virtuales asignados</h2>
            <span className={`text-xs font-medium ${darkMode ? "bg-slate-800 text-slate-300" : "bg-slate-200/60 text-slate-600"} px-2.5 py-0.5 rounded-full`}>{employees.length} registrados</span>
          </div>

          {loading ? (
            <div className={`${darkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200/80 text-slate-400"} border rounded-2xl p-12 text-center text-sm`}>
              Cargando agentes especializados...
            </div>
          ) : employees.length === 0 ? (
            <div className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-300"} border border-dashed rounded-2xl p-12 text-center space-y-3`}>
              <p className={`${darkMode ? "text-slate-300" : "text-slate-600"} font-medium text-sm`}>No hay empleados digitales todavía</p>
              <button 
                onClick={() => {
                  if (!isSubscriptionActive) {
                    alert("Tu periodo de prueba ha finalizado.");
                    return;
                  }
                  router.push("/dashboard/new");
                }} 
                className={`text-xs font-medium px-4 py-2.5 rounded-xl text-white transition-all cursor-pointer ${
                  isSubscriptionActive ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-700 cursor-not-allowed"
                }`}
              >
                + Crear Asistente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map((emp) => (
                <div key={emp.id} className={`${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"} border shadow-xs hover:shadow-md transition-all rounded-2xl p-4 sm:p-6 flex flex-col justify-between space-y-5`}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={emp.avatar_url || emp.image_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"} 
                        alt={emp.name} 
                        className="w-12 h-12 rounded-full object-cover border border-slate-700/50 shadow-xs"
                      />
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className={`font-bold text-base ${darkMode ? "text-white" : "text-slate-900"} tracking-tight truncate`}>{emp.name}</h3>
                          {emp.isShared && (
                            <span className="bg-purple-950 text-purple-300 border border-purple-800/60 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
                              Compartido 👥
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-blue-400 truncate">{emp.role}</p>
                      </div>
                    </div>
                    <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"} line-clamp-2 leading-relaxed`}>
                      {emp.objective || emp.personality || "Sin descripción establecida"}
                    </p>
                  </div>

                  <div className={`flex items-center gap-2 pt-3 border-t ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                    <button
                      onClick={() => router.push(`/dashboard/chat/${emp.id}`)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-xl text-xs font-medium transition-all text-center shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      💬 <span>Chatear</span>
                    </button>
                    {!emp.isShared && (
                      <button
                        onClick={() => {
                          if (!isSubscriptionActive) {
                            alert("Cuenta en modo de solo lectura. No se puede configurar.");
                            return;
                          }
                          router.push(`/dashboard/employees/${emp.id}`);
                        }}
                        className={`border px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          isSubscriptionActive 
                            ? (darkMode ? "border-slate-700 hover:bg-slate-800 text-slate-300" : "border-slate-200 hover:bg-slate-50 text-slate-700") 
                            : "border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed"
                        }`}
                      >
                        ⚙️ Config
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${darkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white"}`}>
          <div className="min-w-0">
            <h2 className={`text-base font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>📩 Contacto y reclamos</h2>
            <p className={`text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              ¿Tenés una consulta, problema o reclamo? Escribinos y te respondemos a la brevedad.
            </p>
          </div>
          <a
            href="mailto:techprosoftware3@gmail.com?subject=Contacto%20%2F%20Reclamo"
            className="w-full sm:w-auto shrink-0 text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl text-sm font-medium transition-all break-all"
          >
            techprosoftware3@gmail.com
          </a>
        </section>

        {/* Pie de página con enlaces legales */}
        <footer className={`pt-8 pb-4 border-t ${darkMode ? "border-slate-800/80 text-slate-500" : "border-slate-200/80 text-slate-400"} text-center text-xs flex flex-wrap justify-center gap-x-6 gap-y-2`}>
          <span>© 2026 OS IA - Todos los derechos reservados</span>
          <span>•</span>
          <button 
            onClick={() => router.push("/terms")} 
            className="hover:underline transition-colors cursor-pointer"
          >
            Términos y Condiciones
          </button>
          <span>•</span>
          <button 
            onClick={() => router.push("/privacy")} 
            className="hover:underline transition-colors cursor-pointer"
          >
            Política de Privacidad
          </button>
        </footer>
      </div>
    </div>
  );
}