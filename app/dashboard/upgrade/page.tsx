"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function checkSubscriptionStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email || "");
      setUserId(user.id);

      // Consultar el perfil del usuario para verificar su estado y fechas
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

        const active = Boolean(isTrialActive || isSubActive);
        setIsSubscriptionActive(active);

        if (subEndDate) {
          setSubscriptionEndDate(subEndDate.toLocaleDateString());
        } else if (trialEndsAt) {
          setSubscriptionEndDate(trialEndsAt.toLocaleDateString());
        }
      }

      setChecking(false);
    }

    checkSubscriptionStatus();
  }, [supabase, router]);

  // Función modificada para recibir el tipo de plan ('monthly' o 'yearly')
  const handleCheckout = async (planType: 'monthly' | 'yearly') => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payment/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail, userId, planType }), // Enviamos el plan elegido
      });

      const data = await res.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert("Error al generar el pago: " + (data.error || "Desconocido"));
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al procesar el pago.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100 text-gray-600">
        Verificando estado de suscripción...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 sm:p-6 text-gray-800">
      <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl text-center space-y-6 border border-gray-200">
        
        {isSubscriptionActive ? (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold text-gray-900">¡Tu cuenta está al día!</h1>
            <p className="text-sm text-gray-600">
              Actualmente dispones de acceso activo e ilimitado a todos tus empleados virtuales.
              {subscriptionEndDate && (
                <span className="block mt-1 font-medium text-gray-700">Vigente hasta: {subscriptionEndDate}</span>
              )}
            </p>

            <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-left text-sm space-y-1">
              <p className="font-semibold text-green-900">Plan Activo - AI Employees</p>
              <p className="text-green-700">Todas las funciones operativas habilitadas.</p>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 rounded-xl transition shadow-md cursor-pointer"
            >
              Volver al Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900">Periodo de prueba finalizado</h1>
            <p className="text-sm text-gray-600">
              Tu acceso al sistema requiere una suscripción activa para seguir operando con tus empleados virtuales.
            </p>

            {/* Opciones de Planes (Mensual / Anual) */}
            <div className="space-y-3">
              {/* Opción Mensual */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-left text-sm flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <div>
                  <p className="font-semibold text-blue-900">Plan Mensual</p>
                  <p className="text-blue-700">$10.000 / mes (Débito automático)</p>
                </div>
                <button
                  onClick={() => handleCheckout('monthly')}
                  disabled={loading || !userId}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer text-xs w-full sm:w-auto shrink-0"
                >
                  {loading ? "..." : "Elegir Mensual"}
                </button>
              </div>

              {/* Opción Anual */}
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl text-left text-sm flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <div>
                  <p className="font-semibold text-purple-900">Plan Anual</p>
                  <p className="text-purple-700">$100.000 / año (Ahorro y acceso total)</p>
                </div>
                <button
                  onClick={() => handleCheckout('yearly')}
                  disabled={loading || !userId}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer text-xs w-full sm:w-auto shrink-0"
                >
                  {loading ? "..." : "Elegir Anual"}
                </button>
              </div>
            </div>
          </>
        )}

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer block mx-auto"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}