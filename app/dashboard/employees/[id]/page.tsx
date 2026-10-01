"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EmployeeManagementPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "memories" | "documents" | "channel" | "tasks" | "share">("profile");

  // Estados del empleado
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Estados de memorias
  const [memories, setMemories] = useState<any[]>([]);
  const [newMemory, setNewMemory] = useState("");

  // Estados de documentos y archivos adjuntos
  const [documents, setDocuments] = useState<any[]>([]);

  // Estados de tareas
  const [tasks, setTasks] = useState<any[]>([]);

  // Estados para compartir
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);

  // Cargar datos del empleado, permisos, suscripción, memorias y documentos
  useEffect(() => {
    async function loadEmployeeData() {
      if (!employeeId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 1. Verificar estado de suscripción
      const { data: profile } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_end_date, subscription_plan")
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

      // 2. Obtener datos del empleado
      const { data: emp, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", employeeId)
        .maybeSingle();

      if (error || !emp) {
        console.error("Error al buscar empleado:", error);
        alert("Empleado no encontrado.");
        router.push("/dashboard");
        return;
      }

      // 3. Verificar permisos de acceso
      let hasAccess = emp.user_id === user.id;
      if (!hasAccess && user.email) {
        const { data: share } = await supabase
          .from("employee_shares")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("shared_with_email", user.email)
          .maybeSingle();
        if (share) hasAccess = true;
      }

      if (!hasAccess) {
        alert("No tienes permisos para acceder a este empleado.");
        router.push("/dashboard");
        return;
      }

      setName(emp.name || "");
      setRole(emp.role || "");
      setObjective(emp.objective || "");
      setInstructions(emp.instructions || emp.personality || "");
      setAvatarUrl(emp.avatar_url || emp.avatar || "");

      // 4. Memorias
      const { data: mems } = await supabase
        .from("memories")
        .select("*")
        .eq("employee_id", employeeId);
      setMemories(mems || []);

      // 5. Documentos y Fotos
      fetchDocuments();

      // 6. Tareas
      const { data: tks } = await supabase
        .from("tasks")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      setTasks(tks || []);

      // 7. Usuarios compartidos
      fetchSharedUsers();

      setLoading(false);
    }

    loadEmployeeData();
  }, [employeeId, supabase, router]);

  async function fetchDocuments() {
    const { data: docs } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });
    setDocuments(docs || []);
  }

  async function fetchSharedUsers() {
    const { data, error } = await supabase
      .from("employee_shares")
      .select("*")
      .eq("employee_id", employeeId);

    if (!error && data) {
      setSharedUsers(data);
    }
  }

  // Guardar cambios del perfil
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubscriptionActive) {
      alert("Tu periodo de prueba ha finalizado. La cuenta está en modo de solo lectura.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("employees")
      .update({ 
        name, 
        role, 
        objective, 
        instructions, 
        avatar_url: avatarUrl 
      })
      .eq("id", employeeId);

    setSaving(false);
    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      alert("¡Perfil actualizado con éxito!");
    }
  }

  // Eliminar empleado
  async function handleDeleteEmployee() {
    if (!isSubscriptionActive) {
      alert("Tu periodo de prueba ha finalizado. La cuenta está en modo de solo lectura.");
      return;
    }

    if (!confirm("¿Estás seguro de eliminar este empleado? Esta acción borrará todas sus memorias, tareas y chats asociados.")) {
      return;
    }

    setDeleting(true);

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", employeeId);

    setDeleting(false);

    if (error) {
      alert("Error al eliminar el empleado: " + error.message);
    } else {
      alert("Empleado eliminado correctamente.");
      router.push("/dashboard");
    }
  }

  // Agregar memoria
  async function handleAddMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubscriptionActive) {
      alert("Tu periodo de prueba ha finalizado. La cuenta está en modo de solo lectura.");
      return;
    }
    if (!newMemory.trim()) return;

    const { data, error } = await supabase
      .from("memories")
      .insert({ employee_id: employeeId, content: newMemory.trim() })
      .select()
      .single();

    if (error) {
      alert("Error al agregar memoria: " + error.message);
    } else if (data) {
      setMemories([data, ...memories]);
      setNewMemory("");
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    if (!isSubscriptionActive) return;
    const { error } = await supabase.from("memories").delete().eq("id", memoryId);
    if (!error) {
      setMemories(memories.filter((m) => m.id !== memoryId));
    }
  }

  // Subir documento/PDF/foto a la memoria
  async function handleUploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSubscriptionActive) {
      alert("Tu periodo de prueba ha finalizado.");
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("employeeId", employeeId);

    try {
      const res = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir documento");

      alert("¡Documento subido y añadido a la memoria del empleado!");
      fetchDocuments();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUploadingDoc(false);
      e.target.value = "";
    }
  }

  // Eliminar documento de la memoria
  async function handleDeleteDocument(docId: string) {
    if (!isSubscriptionActive) return;
    if (!confirm("¿Estás seguro de eliminar este documento?")) return;

    const { error } = await supabase.from("employee_documents").delete().eq("id", docId);
    if (!error) {
      setDocuments(documents.filter((d) => d.id !== docId));
    } else {
      alert("Error al eliminar documento: " + error.message);
    }
  }

  // Compartir empleado
  async function handleShare(e: React.FormEvent) {
    e.preventDefault();
    if (!isSubscriptionActive || !shareEmail) return;

    setSharing(true);
    setShareMessage(null);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share", employeeId, email: shareEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo compartir.");

      setShareMessage({ text: "¡Empleado compartido correctamente!", type: "success" });
      setShareEmail("");
      fetchSharedUsers();
    } catch (err: any) {
      setShareMessage({ text: err.message, type: "error" });
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeAccess(shareId: string) {
    if (!isSubscriptionActive) return;
    if (!confirm("¿Revocar acceso?")) return;

    const { error } = await supabase.from("employee_shares").delete().eq("id", shareId);
    if (!error) {
      setSharedUsers(sharedUsers.filter((s) => s.id !== shareId));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-600">
        Cargando panel de gestión...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 bg-gray-50 min-h-screen text-gray-800">
      {!isSubscriptionActive && (
        <div className="mb-6 bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 rounded-lg shadow-sm">
          <p className="font-semibold">⚠️ Modo de solo lectura</p>
          <p className="text-sm">Tu periodo de prueba ha finalizado. Las funciones de modificación están bloqueadas.</p>
        </div>
      )}

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={name} 
              className="w-16 h-16 shrink-0 rounded-full object-cover border-2 border-blue-600 shadow-sm"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/150?text=Error"; }}
            />
          ) : (
            <div className="w-16 h-16 shrink-0 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xl border-2 border-blue-300">
              {name ? name.charAt(0).toUpperCase() : "AI"}
            </div>
          )}
          <div className="min-w-0">
            <button onClick={() => router.push("/dashboard")} className="text-sm text-blue-600 hover:underline mb-1 inline-block">
              ← Volver al Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold break-words">{name}</h1>
            <p className="text-gray-500">{role}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/dashboard/chat/${employeeId}`)}
          className="w-full sm:w-auto shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        >
          💬 Ir al Chat en Vivo
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex border-b border-gray-200 mb-6 space-x-4 overflow-x-auto">
        <button onClick={() => setActiveTab("profile")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "profile" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          ⚙️ Perfil e Instrucciones
        </button>
        <button onClick={() => setActiveTab("memories")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "memories" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          🧠 Memorias ({memories.length})
        </button>
        <button onClick={() => setActiveTab("documents")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "documents" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          📁 Documentos y Fotos ({documents.length})
        </button>
        <button onClick={() => setActiveTab("channel")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "channel" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          📱 Canal Externo
        </button>
        <button onClick={() => setActiveTab("tasks")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "tasks" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          📋 Tareas ({tasks.length})
        </button>
        <button onClick={() => setActiveTab("share")} className={`pb-2 font-medium whitespace-nowrap ${activeTab === "share" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
          👥 Compartir ({sharedUsers.length})
        </button>
      </div>

      {/* 1. PERFIL */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold mb-4">Configuración del Empleado Virtual</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!isSubscriptionActive} className="w-full border rounded-lg p-2.5 outline-none disabled:bg-gray-100" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol / Puesto</label>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} disabled={!isSubscriptionActive} className="w-full border rounded-lg p-2.5 outline-none disabled:bg-gray-100" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL de la Foto de Perfil</label>
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} disabled={!isSubscriptionActive} placeholder="https://..." className="w-full border rounded-lg p-2.5 outline-none text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo Principal</label>
            <input type="text" value={objective} onChange={(e) => setObjective(e.target.value)} disabled={!isSubscriptionActive} className="w-full border rounded-lg p-2.5 outline-none disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones y Personalidad (System Prompt)</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={!isSubscriptionActive} rows={5} className="w-full border rounded-lg p-2.5 outline-none font-mono text-sm disabled:bg-gray-100" />
          </div>
          <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t">
            <button type="submit" disabled={saving || !isSubscriptionActive} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            <button type="button" onClick={handleDeleteEmployee} disabled={deleting || !isSubscriptionActive} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-4 py-2.5 rounded-lg font-medium transition disabled:opacity-50">
              {deleting ? "Eliminando..." : "🗑️ Eliminar Empleado"}
            </button>
          </div>
        </form>
      )}

      {/* 2. MEMORIAS */}
      {activeTab === "memories" && (
        <div className="space-y-6">
          <form onSubmit={handleAddMemory} className="bg-white p-4 sm:p-6 rounded-xl shadow flex flex-col sm:flex-row gap-3">
            <input type="text" value={newMemory} onChange={(e) => setNewMemory(e.target.value)} disabled={!isSubscriptionActive} placeholder="Añade una nueva memoria..." className="flex-1 border rounded-lg p-2.5 outline-none disabled:bg-gray-100" />
            <button type="submit" disabled={!isSubscriptionActive} className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50">
              + Agregar Memoria
            </button>
          </form>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-3">
            <h2 className="text-xl font-semibold mb-2">Memoria Interna Actual</h2>
            {memories.length === 0 ? <p className="text-gray-400 italic">No hay notas registradas.</p> : (
              memories.map((mem) => (
                <div key={mem.id} className="flex justify-between items-center gap-3 bg-gray-50 border p-3 rounded-lg">
                  <p className="text-sm min-w-0 break-words">{mem.content}</p>
                  {isSubscriptionActive && (
                    <button onClick={() => handleDeleteMemory(mem.id)} className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0">Eliminar</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. NUEVA PESTAÑA: DOCUMENTOS Y FOTOS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-4">
            <h2 className="text-xl font-semibold">Subir PDFs o Imágenes a la Memoria</h2>
            <p className="text-sm text-gray-500">Sube manuales, políticas en PDF o fotos para que tu empleado virtual pueda consultarlos y compartirlos en las conversaciones.</p>
            
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={!isSubscriptionActive || uploadingDoc}
              onChange={handleUploadDocument}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer disabled:opacity-50"
            />
            {uploadingDoc && <p className="text-sm text-blue-600 font-medium animate-pulse">Subiendo archivo y procesando...</p>}
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-3">
            <h2 className="text-xl font-semibold mb-2">Documentos Cargados</h2>
            {documents.length === 0 ? <p className="text-gray-400 italic">No hay documentos ni fotos adjuntas todavía.</p> : (
              documents.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center gap-3 bg-gray-50 border p-3 rounded-lg">
                  <div className="min-w-0">
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-2 break-all">
                      📄 {doc.title} ({doc.file_type.toUpperCase()})
                    </a>
                    <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  {isSubscriptionActive && (
                    <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0">Eliminar</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. CANAL EXTERNO */}
      {activeTab === "channel" && (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold">Integración con Canales Externos</h2>
          <div className="bg-gray-100 p-4 rounded-lg border space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase">Employee ID</label>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={employeeId} className="w-full min-w-0 bg-white border rounded p-2 font-mono text-sm text-gray-700" />
              <button onClick={() => { navigator.clipboard.writeText(employeeId); alert("¡ID copiado!"); }} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-black transition">Copiar</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAREAS */}
      {activeTab === "tasks" && (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-4">
          <h2 className="text-xl font-semibold">Tareas Registradas</h2>
          {tasks.length === 0 ? <p className="text-gray-400 italic">No hay tareas generadas todavía.</p> : (
            tasks.map((task) => (
              <div key={task.id} className="border p-4 rounded-lg bg-gray-50 space-y-1">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-semibold text-blue-900 break-words">{task.title}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{task.status}</span>
                </div>
                <p className="text-sm text-gray-600">{task.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. COMPARTIR */}
      {activeTab === "share" && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-4">
            <h2 className="text-xl font-semibold">Compartir Agente con Otro Usuario</h2>
            <form onSubmit={handleShare} className="flex flex-col sm:flex-row gap-3">
              <input type="email" placeholder="correo@ejemplo.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} disabled={!isSubscriptionActive} required className="flex-1 border rounded-lg p-2.5 outline-none text-sm disabled:bg-gray-100" />
              <button type="submit" disabled={sharing || !isSubscriptionActive} className="bg-black text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50 text-sm">
                {sharing ? "Compartiendo..." : "Compartir 👥"}
              </button>
            </form>
            {shareMessage && <p className={`text-xs font-medium ${shareMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>{shareMessage.text}</p>}
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow space-y-3">
            <h2 className="text-xl font-semibold mb-2">Usuarios con Acceso</h2>
            {sharedUsers.length === 0 ? <p className="text-gray-400 italic">Este agente aún no ha sido compartido.</p> : (
              sharedUsers.map((share) => (
                <div key={share.id} className="flex flex-wrap justify-between items-center gap-3 bg-gray-50 border p-3 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 break-all">{share.shared_with_email}</p>
                    <p className="text-xs text-gray-400">Compartido el: {new Date(share.created_at || Date.now()).toLocaleDateString()}</p>
                  </div>
                  {isSubscriptionActive && (
                    <button onClick={() => handleRevokeAccess(share.id)} className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 bg-red-50 rounded hover:bg-red-100 transition">Revocar acceso</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}