"use client";

import { useState } from "react";

type MemoryBoxProps = {
  employeeId: string;
};

export default function MemoryBox({
  employeeId,
}: MemoryBoxProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function saveMemory() {
    if (!content.trim() || loading) {
      return;
    }

    setLoading(true);
    setSaved(false);
    setError("");

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          content: content.trim(),
          type: "general",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo guardar la memoria."
        );
      }

      setContent("");
      setSaved(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-3xl border bg-white p-6">
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl">
            🧠
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Memoria
            </h2>

            <p className="text-sm text-gray-500">
              Guardale información importante a tu empleado.
            </p>
          </div>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
          setError("");
        }}
        placeholder="Ejemplo: Nuestra inmobiliaria trabaja principalmente con propiedades de hasta USD 150.000."
        className="min-h-28 w-full resize-none rounded-2xl border border-gray-300 p-4 text-sm text-gray-900 outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
      />

      {error && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {saved && (
        <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-700">
          ✓ Memoria guardada correctamente.
        </div>
      )}

      <button
        onClick={saveMemory}
        disabled={loading || !content.trim()}
        className="mt-4 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Guardando..." : "Guardar memoria"}
      </button>
    </section>
  );
}