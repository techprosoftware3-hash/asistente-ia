"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewEmployeePage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("No estás autenticado.");
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        user_id: user.id,
        name: name.trim(),
        role: role.trim(),
        objective: objective.trim(),
        instructions: instructions.trim(),
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert("Error al crear el empleado: " + error.message);
    } else if (data) {
      router.push(`/dashboard/employees/${data.id}`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-50 min-h-screen text-gray-800">
      <button 
        onClick={() => router.push("/dashboard")} 
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Volver al Dashboard
      </button>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Crear Nuevo Empleado Virtual</h1>
        <p className="text-sm text-gray-500 mb-6">Configura el rol, objetivos e instrucciones base de tu nuevo agente autónomo.</p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Agente</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ej: Hadassa, SupportBot..." 
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Puesto</label>
              <input 
                type="text" 
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                placeholder="Ej: Asistente Analista de Soporte IT" 
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo Principal</label>
            <input 
              type="text" 
              value={objective} 
              onChange={(e) => setObjective(e.target.value)} 
              placeholder="Ej: Resolver incidencias técnicas y registrar tareas de mantenimiento." 
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones y Personalidad (System Prompt)</label>
            <textarea 
              value={instructions} 
              onChange={(e) => setInstructions(e.target.value)} 
              rows={5} 
              placeholder="Describe cómo debe comportarse, qué tono usar y qué reglas debe seguir..." 
              className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => router.push("/dashboard")} 
              className="border px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="bg-black text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Creando agente..." : "Crear Empleado Virtual"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}