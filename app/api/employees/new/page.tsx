"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewEmployeePage() {
  const router = useRouter();
  const supabase = createClient();

  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [error, setError] = useState("");

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

  async function createEmployee() {
    if (!isSubscriptionActive) {
      setError("Tu periodo de prueba ha finalizado. La cuenta está en modo de solo lectura.");
      return;
    }

    if (!description.trim()) {
      setError("Contanos qué trabajo querés que haga.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/employees/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo crear el empleado"
        );
      }

      // Redirección corregida apuntando correctamente a /dashboard/employees/...
      router.push(`/dashboard/employees/${data.employee.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Error desconocido"
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSub) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-600">
        Verificando estado de la cuenta...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Volver al Dashboard
        </button>

        <h1 className="text-4xl font-bold">
          Crear empleado
        </h1>

        <p className="mt-3 text-gray-600">
          Explicá qué trabajo querés que haga.
          La IA se encargará de diseñarlo.
        </p>

        {/* Aviso si la suscripción venció */}
        {!isSubscriptionActive && (
          <div className="mt-6 bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 rounded-xl shadow-sm">
            <p className="font-semibold">⚠️ Modo de solo lectura</p>
            <p className="text-sm">Tu periodo de prueba ha finalizado. La creación de nuevos empleados se encuentra bloqueada.</p>
          </div>
        )}

        <div className="mt-6 rounded-3xl border bg-white p-8">
          <label className="text-sm font-medium">
            ¿Qué querés que haga tu empleado?
          </label>

          <textarea
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
            disabled={!isSubscriptionActive}
            placeholder={isSubscriptionActive ? "Ejemplo: Quiero un empleado que consiga clientes para mi inmobiliaria, los clasifique y haga seguimiento..." : "Deshabilitado por suscripción vencida"}
            className="mt-3 min-h-48 w-full rounded-2xl border p-5 outline-none focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={createEmployee}
            disabled={loading || !isSubscriptionActive}
            className="mt-6 w-full rounded-2xl bg-black py-4 font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-gray-800"
          >
            {loading
              ? "Construyendo empleado..."
              : "Construir empleado"}
          </button>
        </div>
      </div>
    </main>
  );
}