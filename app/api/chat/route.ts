import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL_NAME = "google/gemini-3.5-flash"; 

function parsePartialJson(rawJson: string) {
  try {
    return JSON.parse(rawJson);
  } catch (e) {
    try {
      const sanitized = rawJson.trim() + (rawJson.trim().endsWith("}") ? "" : "}");
      return JSON.parse(sanitized);
    } catch (err) {
      const titleMatch = rawJson.match(/"title"\s*:\s*"([^"]+)"/);
      const typeMatch = rawJson.match(/"file_type"\s*:\s*"([^"]+)"/);
      const contentMatch = rawJson.match(/"content"\s*:\s*"([\s\S]*)/);

      return {
        title: titleMatch ? titleMatch[1] : "Documento Generado",
        file_type: typeMatch ? typeMatch[1] : "document",
        content: contentMatch ? contentMatch[1].replace(/["}\s]+$/, "") : rawJson
      };
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  let requestBody: any = {};

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No estás autenticado." }, { status: 401 });
    }

    requestBody = await request.json();
    const employeeId = requestBody.employeeId;
    const message = requestBody.message;

    if (!employeeId || !message) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    let hasAccess = false;
    if (employee) {
      if (employee.user_id === user.id) {
        hasAccess = true;
      } else if (user.email) {
        const { data: share } = await supabase
          .from("employee_shares")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("shared_with_email", user.email)
          .single();
        if (share) hasAccess = true;
      }
    }

    if (employeeError || !hasAccess || !employee) {
      return NextResponse.json({ error: "Empleado no encontrado o sin permisos de acceso." }, { status: 404 });
    }

    const ownerId = employee.user_id;

    // ⚡ 2. CONSULTAS EN PARALELO (Incluyendo employee_documents)
    const [
      userProfileRes,
      employeeMemoriesRes,
      colleaguesRes,
      globalMemoriesRes,
      recentFilesRes,
      employeeDocsRes,
      previousMessagesRes
    ] = await Promise.all([
      supabase.from("profiles").select("trial_ends_at, subscription_status, subscription_end_date, company_name").eq("id", user.id).maybeSingle(),
     supabase.from("memories").select("content").eq("employee_id", employeeId).order("created_at", { ascending: false }),
      supabase.from("employees").select("id, name, role").eq("user_id", ownerId).neq("id", employeeId),
      supabase.from("global_memories").select("title, content, category").eq("user_id", ownerId).limit(20),
      supabase.from("files").select("title, file_type, created_at").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(2),
      supabase.from("employee_documents").select("title, file_url, file_type, extracted_text").eq("employee_id", employeeId),
      supabase.from("messages").select("role, content").eq("employee_id", employeeId).order("created_at", { ascending: true }).limit(8)
      
    ]);

    const { data: ownerProfileResCheck } = await supabase.from("profiles").select("trial_ends_at, subscription_status, subscription_end_date").eq("id", ownerId).maybeSingle();
    
    const userProfile = userProfileRes.data;
    const companyName = userProfile?.company_name || "Mi Empresa / Oficina";

    if (ownerProfileResCheck) {
      const now = new Date();
      const trialEndsAt = ownerProfileResCheck.trial_ends_at ? new Date(ownerProfileResCheck.trial_ends_at) : now;
      const subEndDate = ownerProfileResCheck.subscription_end_date ? new Date(ownerProfileResCheck.subscription_end_date) : null;

      const isTrialActive = now < trialEndsAt;
      const isSubActive = ownerProfileResCheck.subscription_status === "active" && subEndDate && now < subEndDate;
      const isSubscriptionActive = Boolean(isTrialActive || isSubActive);

      if (!isSubscriptionActive) {
        return NextResponse.json(
          { error: "El periodo de prueba ha finalizado. Las funciones de chat están bloqueadas." },
          { status: 403 }
        );
      }
    }

    const employeeMemoriesText = (employeeMemoriesRes.data ?? []).map((m) => `- ${m.content}`).join("\n");
    const globalMemoriesText = (globalMemoriesRes.data ?? []).map((g) => `- [${g.category || 'General'}] ${g.title}: ${g.content}`).join("\n");
    
    // Texto de los documentos/PDFs/fotos cargadas
    const employeeDocsText = (employeeDocsRes.data ?? [])
      .map((d) => `- Archivo: "${d.title}" (${d.file_type})\n  Enlace de descarga: ${d.file_url}\n  Descripción/Contenido: ${d.extracted_text || 'Sin descripción adicional'}`)
      .join("\n\n");

    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = (previousMessagesRes.data ?? []).map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    const currentDate = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `Sos ${employee.name}, un empleado virtual que trabaja oficialmente para la empresa u oficina **"${companyName}"**. 
Tu rol oficial y área de trabajo es: **${employee.role}**. 
🎯 Objetivo principal: ${employee.objective || "Cumplir con las tareas asignadas"}.
🧠 Personalidad y estilo: ${employee.instructions || employee.personality || "Sé amable y profesional."}.
📅 Fecha actual: ${currentDate}.
🏢 Empresa: "${companyName}".
🌐 Políticas: ${globalMemoriesText || "Ninguna."}
💡 Memoria: ${employeeMemoriesText || "Ninguna."}

📁 DOCUMENTOS E IMÁGENES ADJUNTOS EN TU MEMORIA (Si el usuario te pide un archivo, manual o foto, compárteme el enlace markdown correspondiente):
${employeeDocsText || "No hay documentos ni fotos cargados todavía."}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...conversation,
      { role: "user", content: message },
    ];

    const tools: OpenAI.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "delegate_task",
          description: "Delega explícitamente una tarea a otro colega.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              target_employee_name: { type: "string" }
            },
            required: ["title", "description", "target_employee_name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Crea una tarea interna para este empleado.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_document",
          description: "Genera y guarda un documento profesional.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              file_type: { type: "string", enum: ["document", "spreadsheet"] },
              content: { type: "string" }
            },
            required: ["title", "file_type", "content"]
          }
        }
      }
    ];

    const response = await openrouter.chat.completions.create({
      model: MODEL_NAME,
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 1000,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        let fullAssistantMessage = "";
        let toolCallsBuffer: any[] = [];
        let actionTypeDesc = "chat_stream_response";
        let associatedTaskId: string | null = null;
        let toolArgumentsUsed = null;

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            fullAssistantMessage += delta.content;
            controller.enqueue(encoder.encode(delta.content));
          }

          if (delta?.tool_calls) {
            for (const tCall of delta.tool_calls) {
              const index = tCall.index;
              if (!toolCallsBuffer[index]) {
                toolCallsBuffer[index] = { id: tCall.id, function: { name: "", arguments: "" } };
              }
              if (tCall.id) toolCallsBuffer[index].id = tCall.id;
              if (tCall.function?.name) toolCallsBuffer[index].function.name += tCall.function.name;
              if (tCall.function?.arguments) toolCallsBuffer[index].function.arguments += tCall.function.arguments;
            }
          }
        }

        if (toolCallsBuffer.length > 0) {
          const toolCall = toolCallsBuffer[0];
          const functionName = toolCall.function.name;
          const functionArgs = parsePartialJson(toolCall.function.arguments || "{}");
          toolArgumentsUsed = functionArgs;

          if (functionName === "create_task") {
            const newTaskRes = await supabase.from("tasks").insert({
              employee_id: employeeId,
              title: functionArgs.title || "Tarea asignada",
              description: functionArgs.description || message,
              status: "pending"
            }).select("id").single();

            associatedTaskId = (newTaskRes.data as { id: string } | null)?.id || null;
            const toolMsg = `\n\n✅ **¡Tarea registrada con éxito!**\n- **Título:** ${functionArgs.title}`;
            fullAssistantMessage += toolMsg;
            controller.enqueue(encoder.encode(toolMsg));
            actionTypeDesc = "create_task";
          } 
          else if (functionName === "create_document") {
            const fileType = functionArgs.file_type || "document";
            const fileExtension = fileType === "spreadsheet" ? ".csv" : ".md";
            const rawTitle = functionArgs.title || "Documento";
            const titleWithExt = rawTitle.endsWith(fileExtension) ? rawTitle : `${rawTitle}${fileExtension}`;
            let docContent = functionArgs.content || `# ${companyName} - ${rawTitle}\n\n${message}`;

            await supabase.from("files").insert({
              employee_id: employeeId,
              user_id: user.id,
              title: titleWithExt,
              file_type: fileType,
              content: docContent
            });

            const toolMsg = `\n\n📂 **¡Documento generado con éxito!**\nSe guardó el archivo \`${titleWithExt}\`.`;
            fullAssistantMessage += toolMsg;
            controller.enqueue(encoder.encode(toolMsg));
            actionTypeDesc = "create_document";
          }
        }

        if (!fullAssistantMessage || fullAssistantMessage.trim() === "") {
          fullAssistantMessage = "¡Listo! Operación realizada correctamente.";
          controller.enqueue(encoder.encode(fullAssistantMessage));
        }

        await Promise.all([
          supabase.from("messages").insert([
            { employee_id: employeeId, role: "user", content: message },
            { employee_id: employeeId, role: "assistant", content: fullAssistantMessage }
          ]),
          supabase.from("action_logs").insert({
            employee_id: employeeId,
            task_id: associatedTaskId,
            action_type: actionTypeDesc,
            status: "success",
            input: { message, tool_arguments: toolArgumentsUsed },
            output: { response: fullAssistantMessage },
            error: null
          })
        ]);

        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("Error en streaming con OpenRouter:", error);
    return NextResponse.json({ error: error.message || "Error desconocido." }, { status: 500 });
  }
}