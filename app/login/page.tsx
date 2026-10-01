"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    const supabase = createClient();

    // SI SUPERÓ LOS 3 INTENTOS Y ESTÁ USANDO LA PALABRA SECRETA
    if (failedAttempts >= 3) {
      if (!secretWord.trim() || !newPassword.trim()) {
        setError("Por favor, completa tu palabra secreta y la nueva contraseña.");
        setLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        setError("La nueva contraseña debe tener al menos 6 caracteres.");
        setLoading(false);
        return;
      }

      // 1. Verificamos la palabra secreta en la tabla profiles junto al email ingresado
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, secret_word")
        .eq("secret_word", secretWord.trim())
        .maybeSingle();

      if (profileError || !profileData) {
        setError("Palabra secreta incorrecta para este usuario. Verifícala e intenta nuevamente.");
        setLoading(false);
        return;
      }

      // 2. Actualizamos la contraseña directamente mediante un Server Action o ruta de API segura
      try {
        const response = await fetch("/api/auth/update-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), newPassword: newPassword.trim() }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "No se pudo actualizar la contraseña.");
        }

        // 3. Con la contraseña ya actualizada, iniciamos sesión de forma automática
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: newPassword,
        });

        if (signInError) {
          setError("Contraseña actualizada, pero hubo un error al iniciar sesión automáticamente. Intenta loguearte con tu nueva clave.");
          setLoading(false);
          return;
        }

        // ¡Listo! Redirigimos al dashboard con éxito
        router.push("/dashboard");
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Error al procesar el cambio de contraseña.");
        setLoading(false);
      }
      return;
    }

    // FLUJO NORMAL DE LOGIN CON CONTRASEÑA
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 3) {
        setError("Demasiados intentos fallidos. Por seguridad, ahora debes ingresar tu palabra secreta para restablecer tu cuenta.");
      } else {
        setError(`Contraseña incorrecta. Te quedan ${3 - newAttempts} intentos antes de requerir tu palabra secreta.`);
      }

      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-black transition"
          >
            ← Volver
          </Link>

          <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="mt-2 text-gray-500">
            Accede a tu panel de empleados digitales
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-3xl border bg-white p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {failedAttempts < 3 ? (
            <div>
              <label className="text-sm font-medium block mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-4">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs uppercase tracking-wider">
                <span>⚠️</span> Recuperación por Palabra Secreta
              </div>
              <p className="text-xs text-amber-700">
                Has superado los intentos. Ingresa tu palabra secreta y tu nueva contraseña para actualizarla al instante y entrar.
              </p>
              
              <div>
                <label className="text-xs font-semibold text-amber-900 block mb-1">Palabra Secreta</label>
                <input
                  type="text"
                  required
                  value={secretWord}
                  onChange={(e) => setSecretWord(e.target.value)}
                  placeholder="Tu palabra secreta..."
                  className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-900 block mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres..."
                  className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 space-y-2">
              <p>{successMsg}</p>
              <button
                type="button"
                onClick={() => {
                  setSuccessMsg("");
                  setFailedAttempts(0);
                  setPassword("");
                  setSecretWord("");
                  setNewPassword("");
                  router.push("/login");
                  window.location.reload();
                }}
                className="text-xs font-bold underline block mt-2 text-emerald-900 cursor-pointer"
              >
                Volver a iniciar sesión
              </button>
            </div>
          )}

          {!successMsg && (
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-black py-3 font-medium text-white disabled:opacity-50 transition hover:bg-gray-800 cursor-pointer"
            >
              {loading ? "Actualizando e ingresando..." : failedAttempts >= 3 ? "Cambiar Clave e Ingresar" : "Ingresar"}
            </button>
          )}

          <div className="pt-2 text-center">
            <p className="text-sm text-gray-500">¿No tenés una cuenta?</p>
            <Link
              href="/signup"
              className="mt-1 inline-block text-sm font-medium underline text-black hover:text-blue-600"
            >
              Registrate aquí
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}