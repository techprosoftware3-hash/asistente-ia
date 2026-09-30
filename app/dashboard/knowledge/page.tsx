"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext"; // Importamos el contexto global

type GlobalMemory = {
  id: string;
  title: string;
  content: string;
  category: string;
  importance: number;
  created_at: string;
};

export default function GlobalKnowledgePage() {
  const supabase = createClient();
  const router = useRouter();
  const { darkMode, toggleDarkMode, mounted } = useTheme(); // Consumimos el tema global

  const [memories, setMemories] = useState<GlobalMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "general",
    importance: 3,
  });

  // Cargar memorias globales del usuario
  useEffect(() => {
    async function loadGlobalMemories() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("global_memories")
        .select("*")
        .eq("user_id", user.id)
        .order("importance", { ascending: false });

      if (!error && data) {
        setMemories(data);
      }
      setLoading(false);
    }

    loadGlobalMemories();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) throw new Error("No hay usuario autenticado.");

      const { data, error: insertError } = await supabase
        .from("global_memories")
        .insert({
          user_id: user.id,
          title: form.title,
          content: form.content,
          category: form.category,
          importance: Number(form.importance),
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      setMemories([data, ...memories]);
      setForm({ title: "", content: "", category: "general", importance: 3 });
    } catch (err: any) {
      setError(err.message || "Error al guardar el conocimiento global.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMemory = async (id: string) => {
    const { error } = await supabase
      .from("global_memories")
      .delete()
      .eq("id", id);

    if (!error) {
      setMemories(memories.filter((m) => m.id !== id));
    }
  };

  // Evitamos parpadeos de hidratación
  if (!mounted) return null;

  return (
    <main className={`min-h-screen transition-colors duration-200 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-gray-50 text-gray-900"} px-6 py-12`}>
      <div className="mx-auto max-w-4xl space-y-8">
        
        {/* Cabecera con botón de modo nocturno */}
        <div className="flex justify-between items-start">
          <div>
            <a
              href="/dashboard"
              className={`text-sm font-medium ${darkMode ? "text-slate-400 hover:text-white" : "text-gray-500 hover:text-gray-900"} transition`}
            >
              ← Volver al dashboard
            </a>
            <h1 className={`mt-4 text-3xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
              Base de Conocimiento Global
            </h1>
            <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>
              Información transversal y políticas oficiales que todos tus empleados digitales consultarán en sus tareas.
            </p>
          </div>

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

        {/* Formulario de carga */}
        <div className={`rounded-2xl border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"} mb-4`}>
            Añadir directriz corporativa
          </h2>

          {error && (
            <div className={`mb-4 p-3 ${darkMode ? "bg-red-950/50 border-red-900 text-red-300" : "bg-red-50 border-red-200 text-red-700"} border text-sm rounded-lg`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-1`}>
                  Título de la directriz / política
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Política de Precios 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={`w-full px-3 py-2 border ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-white border-gray-300 text-gray-900 focus:ring-black"} rounded-lg text-sm focus:ring-2 focus:outline-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-1`}>
                    Categoría
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: precios, legal"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={`w-full px-3 py-2 border ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-white border-gray-300 text-gray-900 focus:ring-black"} rounded-lg text-sm focus:ring-2 focus:outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-1`}>
                    Importancia (1-5)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={form.importance}
                    onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                    className={`w-full px-3 py-2 border ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-white border-gray-300 text-gray-900 focus:ring-black"} rounded-lg text-sm focus:ring-2 focus:outline-none`}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${darkMode ? "text-slate-300" : "text-gray-700"} mb-1`}>
                Contenido detallado
              </label>
              <textarea
                required
                rows={4}
                placeholder="Detallá las reglas, catálogos o información oficial que los empleados deben conocer..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className={`w-full px-3 py-2 border ${darkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500" : "bg-white border-gray-300 text-gray-900 focus:ring-black"} rounded-lg text-sm focus:ring-2 focus:outline-none`}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 ${darkMode ? "bg-white text-slate-900 hover:bg-slate-200" : "bg-black text-white hover:bg-gray-800"} rounded-lg text-sm font-medium disabled:opacity-50 cursor-pointer`}
              >
                {submitting ? "Guardando..." : "Guardar en conocimiento global"}
              </button>
            </div>
          </form>
        </div>

        {/* Listado de memorias globales */}
        <div className={`rounded-2xl border ${darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200"} p-6 shadow-sm space-y-4`}>
          <h2 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
            Conocimiento activo en la empresa
          </h2>

          {loading ? (
            <p className={`text-sm ${darkMode ? "text-slate-500" : "text-gray-400"}`}>Cargando base de conocimiento...</p>
          ) : memories.length === 0 ? (
            <p className={`text-sm ${darkMode ? "text-slate-400" : "text-gray-500"}`}>No hay directrices globales cargadas todavía.</p>
          ) : (
            <div className="space-y-3">
              {memories.map((m) => (
                <div key={m.id} className={`p-4 rounded-xl border ${darkMode ? "border-slate-800 bg-slate-950/50" : "border-gray-200 bg-gray-50/50"} flex flex-col sm:flex-row justify-between items-start gap-4`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>{m.title}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium ${darkMode ? "bg-slate-800 text-slate-300" : "bg-gray-200 text-gray-700"} uppercase`}>
                        {m.category}
                      </span>
                      <span className="text-xs text-amber-500 font-medium">★ {m.importance}/5</span>
                    </div>
                    <p className={`text-sm ${darkMode ? "text-slate-300" : "text-gray-600"} whitespace-pre-wrap`}>{m.content}</p>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    className="text-xs text-rose-500 hover:text-rose-400 font-medium shrink-0 self-end sm:self-center cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}