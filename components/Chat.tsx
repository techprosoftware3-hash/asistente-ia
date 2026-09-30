"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatProps = {
  employeeId: string;
};

export default function Chat({ employeeId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isWaitingForClosure, setIsWaitingForClosure] = useState(false);

  // Referencia para el contenedor de mensajes y autoscroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Referencias para los temporizadores de inactividad
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Función para reiniciar o limpiar la conversación por completo
  const clearChat = () => {
    setMessages([]);
    setIsWaitingForClosure(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    resetInactivityTimers();
  };

  // Configurar temporizadores de inactividad inteligentes
  const resetInactivityTimers = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);

    if (isWaitingForClosure) {
      closeTimer.current = setTimeout(() => {
        setMessages([]);
        setIsWaitingForClosure(false);
      }, 60 * 1000); 
      return;
    }

    inactivityTimer.current = setTimeout(() => {
      setIsWaitingForClosure(true);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "¿Necesitás algo más o querés que cerremos la conversación por hoy?",
        },
      ]);

      closeTimer.current = setTimeout(() => {
        setMessages([]);
        setIsWaitingForClosure(false);
      }, 2 * 60 * 1000); 

    }, 3 * 60 * 1000); 
  };

  useEffect(() => {
    resetInactivityTimers();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [isWaitingForClosure]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    setIsWaitingForClosure(false);
    resetInactivityTimers();

    const userMessage = input.trim();
    setInput("");

    setMessages((current) => [
      ...current,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al enviar el mensaje.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedMessage = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedMessage += chunk;

          setMessages((current) => {
            const newMessages = [...current];
            newMessages[newMessages.length - 1].content = accumulatedMessage;
            return newMessages;
          });
        }
      }
    } catch (error) {
      setMessages((current) => {
        const newMessages = [...current];
        const errorMessage =
          error instanceof Error
            ? `Error: ${error.message}`
            : "Ocurrió un error.";
        
        newMessages[newMessages.length - 1].content = errorMessage;
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  }

  // Función para manejar la subida de archivos (PDFs o Fotos)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("employeeId", employeeId);

    try {
      const res = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo subir el archivo.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `📂 **¡Archivo subido con éxito!**\nHe guardado **"${file.name}"** en mi memoria y ya puedo consultarlo o compartirlo cuando lo necesites.`,
        },
      ]);
    } catch (error: any) {
      alert(`Error al subir el archivo: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = ""; // Limpiar input
    }
  }

  return (
    <div className="mt-8 overflow-hidden rounded-3xl border bg-white shadow-sm flex flex-col">
      {/* Cabecera fija */}
      <div className="border-b p-6 flex justify-between items-center bg-white z-10">
        <div>
          <h2 className="text-xl font-bold">Hablar con el asistente </h2>
          <p className="mt-1 text-sm text-gray-500">
            Probá cómo trabaja tu asistente de IA.
          </p>
        </div>
        <button
          onClick={clearChat}
          className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Limpiar / Nueva Conversación
        </button>
      </div>

      {/* Contenedor de mensajes con altura fija y scroll interno */}
      <div className="h-[500px] overflow-y-auto space-y-4 p-6 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-gray-400">
            <div>
              <p className="text-lg font-medium">Tu empleado está listo.</p>
              <p className="mt-2 text-sm">Escribile algo para comenzar o adjuntale un archivo.</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-black text-white"
                  : "bg-white border border-gray-200 text-gray-900 shadow-xs"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {(loading || uploading) && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 text-gray-500 shadow-xs animate-pulse">
              {uploading ? "Subiendo archivo a la memoria..." : "Pensando..."}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de envío fijo abajo */}
      <div className="border-t p-4 bg-white">
        <div className="flex gap-3 items-center">
          {/* Botón para adjuntar PDFs o Imágenes */}
          <label className={`cursor-pointer p-2.5 rounded-2xl border border-gray-300 hover:bg-gray-100 transition flex items-center justify-center text-gray-600 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Adjuntar PDF o Foto">
            📎
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>

          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resetInactivityTimers();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Escribile a tu empleado..."
            className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
          />

          <button
            onClick={sendMessage}
            disabled={loading || uploading || !input.trim()}
            className="rounded-2xl bg-black px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}