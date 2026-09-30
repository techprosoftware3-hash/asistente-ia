"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretWord, setSecretWord] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!secretWord.trim()) {
      setError("Por favor, ingresa una palabra secreta para recuperar tu cuenta.");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Registrar al usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const user = authData.user;

    if (user) {
      // 2. Guardar la palabra secreta en la tabla profiles junto al ID del usuario
      // (Nota: Asegúrate de tener la columna 'secret_word' en tu tabla profiles o profiles trigger)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ secret_word: secretWord.trim() })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error al guardar la palabra secreta:", profileError.message);
        // Opcional: Podrías notificar, pero el registro de auth ya fue exitoso
      }
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
            className="text-sm text-gray-500 hover:text-black"
          >
            ← Volver
          </Link>

          <h1 className="mt-6 text-3xl sm:text-4xl font-bold">Crear cuenta</h1>
          <p className="mt-2 text-gray-500">
            Empezá a crear tus empleados digitales
          </p>
        </div>

        <form
          onSubmit={handleSignup}
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

          <div>
            <label className="text-sm font-medium block mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Palabra secreta (para recuperación)</label>
            <input
              type="text"
              required
              value={secretWord}
              onChange={(e) => setSecretWord(e.target.value)}
              placeholder="Ej: El nombre de tu primera mascota..."
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Guarda esta palabra. Te servirá para ingresar si olvidas tu contraseña.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black py-3 font-medium text-white disabled:opacity-50 transition hover:bg-gray-800 cursor-pointer"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <div className="pt-2 text-center">
            <p className="text-sm text-gray-500">¿Ya tenés una cuenta?</p>
            <Link
              href="/login"
              className="mt-1 inline-block text-sm font-medium underline text-black hover:text-blue-600"
            >
              Iniciar sesión
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}