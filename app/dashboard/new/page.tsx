"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/app/context/ThemeContext"; // Importamos el contexto global

export default function NewEmployeePage() {
  const router = useRouter();
  const supabase = createClient();
  const { darkMode, toggleDarkMode, mounted } = useTheme(); // Consumimos el tema global

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [loading, setLoading] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [error, setError] = useState("");

  // Estados para modo IA
  const [description, setDescription] = useState("");

  // Estados para modo Manual
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");

  // Verificar la suscripción al cargar la página
  useEffect(() => {
    async function checkSub() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_end_date")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        const now = new Date();
        const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : now;
        const subEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;

        const isTrialActive = now < trialEndsAt;
        const isSubActive = profile.subscription_status === "active" && subEndDate && now < subEndDate;

        setIsSubscriptionActive(Boolean(isTrialActive || isSubActive));
      }
      setCheckingSub(false);
    }

    checkSub();
  }, [supabase, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubscriptionActive) {
      setError("Tu periodo de prueba ha finalizado. Renueva tu suscripción para crear empleados.");
      return;
    }

    setError("");

    if (mode === "ai" && !description.trim()) {
      setError("Contanos qué trabajo querés que haga.");
      return;
    }

    if (mode === "manual" && (!name.trim() || !role.trim())) {
      setError("El nombre y el rol son obligatorios para la creación manual.");
      return;
    }

    setLoading(true);

    try {
      let payload: any = { action: "generate", description };

      if (mode === "manual") {
        payload = { action: "create-manual", name, role, objective, instructions };
      }

      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo crear el empleado");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido"
      );
    } finally {
      setLoading(false);
    }
  }

  // Evitamos parpadeos de hidratación
  if (!mounted) return null;

  if (checkingSub) {
    return (
      <div className={`flex justify-center items-center h-screen ${darkMode ? "bg-slate-950 text-slate-400" : "bg-gray-50 text-gray-600"}`}>
        Verificando estado de la cuenta...
      </div>
    );
  }

  return (
    <main className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"} p-4 sm:p-8`}>
      <div className="mx-auto max-w-3xl">
        
        {/* Cabecera con botón de retorno y alternador de tema */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/dashboard")}
            className={`text-sm font-medium ${darkMode ? "text-blue-400 hover:underline" : "text-blue-600 hover:underline"} transition cursor-pointer`}
          >
            ← Volver al Dashboard
          </button>

          {/* Botón rápido para alternar tema */}
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

        <h1 className={`text-2xl sm:text-4xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Crear y personalizar tu asistente</h1>
        <p className={`mt-3 ${darkMode ? "text-slate-400" : "text-gray-600"}`}>
          Elegí si preferís diseñarlo automáticamente con IA o completarlo manualmente paso a paso.
        </p>

        {/* Aviso si la suscripción venció */}
        {!isSubscriptionActive && (
          <div className={`mt-6 ${darkMode ? "bg-amber-950/60 border-amber-600 text-amber-200" : "bg-amber-100 border-amber-500 text-amber-800"} border-l-4 p-4 rounded-xl shadow-sm`}>
            <p className="font-semibold">⚠️ Cuenta en modo de solo lectura</p>
            <p className="text-sm">Tu periodo de prueba o suscripción ha finalizado. La creación de nuevos empleados se encuentra deshabilitada hasta que renueves tu plan.</p>
          </div>
        )}

        {/* Pestañas de selección */}
        <div className={`mt-6 flex ${darkMode ? "bg-slate-900 border border-slate-800" : "bg-gray-200"} p-1.5 rounded-2xl max-w-sm`}>
          <button
            type="button"
            onClick={() => { setMode("ai"); setError(""); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
              mode === "ai" 
                ? (darkMode ? "bg-white text-slate-950 shadow-sm" : "bg-white text-black shadow-sm") 
                : (darkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-black")
            }`}
          >
            ✨ Crear con IA
          </button>
          <button
            type="button"
            onClick={() => { setMode("manual"); setError(""); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer ${
              mode === "manual" 
                ? (darkMode ? "bg-white text-slate-950 shadow-sm" : "bg-white text-black shadow-sm") 
                : (darkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-black")
            }`}
          >
            ✏️ Formulario Manual
          </button>
        </div>

        <div className={`mt-6 rounded-3xl border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-5 sm:p-8 shadow-sm transition-colors duration-200`}>
          <form onSubmit={handleCreate}>
            {mode === "ai" ? (
              /* MODO IA */
              <div>
                <label className={`text-sm font-medium block ${darkMode ? "text-slate-200" : "text-gray-900"}`}>
                  ¿Qué querés que haga tu empleado?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isSubscriptionActive}
                  placeholder={isSubscriptionActive ? "Ejemplo: Quiero un empleado que consiga clientes para mi inmobiliaria..." : "Deshabilitado por suscripción vencida"}
                  className={`mt-3 min-h-48 w-full rounded-2xl border p-5 outline-none transition-colors ${
                    darkMode 
                      ? "bg-slate-950 border-slate-800 text-white focus:border-blue-500 disabled:bg-slate-900 disabled:text-slate-600" 
                      : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  } disabled:cursor-not-allowed`}
                />
              </div>
            ) : (
              /* MODO MANUAL */
              <div className="space-y-4">
                <div>
                  <label className={`text-sm font-medium block mb-1 ${darkMode ? "text-slate-200" : "text-gray-900"}`}>Nombre del empleado</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isSubscriptionActive}
                    placeholder="Ej: Roberto Compras"
                    className={`w-full rounded-xl border p-3.5 outline-none transition-colors ${
                      darkMode 
                        ? "bg-slate-950 border-slate-800 text-white focus:border-blue-500 disabled:bg-slate-900 disabled:text-slate-600" 
                        : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    } disabled:cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium block mb-1 ${darkMode ? "text-slate-200" : "text-gray-900"}`}>Rol o Puesto</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={!isSubscriptionActive}
                    placeholder="Ej: Analista de Abastecimiento"
                    className={`w-full rounded-xl border p-3.5 outline-none transition-colors ${
                      darkMode 
                        ? "bg-slate-950 border-slate-800 text-white focus:border-blue-500 disabled:bg-slate-900 disabled:text-slate-600" 
                        : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    } disabled:cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium block mb-1 ${darkMode ? "text-slate-200" : "text-gray-900"}`}>Objetivo Principal</label>
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    disabled={!isSubscriptionActive}
                    placeholder="Ej: Gestionar cotizaciones de repuestos para flotas"
                    className={`w-full rounded-xl border p-3.5 outline-none transition-colors ${
                      darkMode 
                        ? "bg-slate-950 border-slate-800 text-white focus:border-blue-500 disabled:bg-slate-900 disabled:text-slate-600" 
                        : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    } disabled:cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium block mb-1 ${darkMode ? "text-slate-200" : "text-gray-900"}`}>Instrucciones del Sistema (Prompt base)</label>
                  <textarea
                    rows={3}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={!isSubscriptionActive}
                    placeholder="Describe su comportamiento, tono y reglas..."
                    className={`w-full rounded-xl border p-3.5 outline-none transition-colors ${
                      darkMode 
                        ? "bg-slate-950 border-slate-800 text-white focus:border-blue-500 disabled:bg-slate-900 disabled:text-slate-600" 
                        : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    } disabled:cursor-not-allowed`}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className={`mt-4 text-sm ${darkMode ? "text-red-400" : "text-red-600"}`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !isSubscriptionActive}
              className={`mt-6 w-full rounded-2xl py-4 font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                darkMode 
                  ? "bg-white text-slate-950 hover:bg-slate-200" 
                  : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              {loading
                ? "Guardando empleado..."
                : mode === "ai"
                ? "Construir empleado con IA"
                : "Guardar empleado manualmente"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}