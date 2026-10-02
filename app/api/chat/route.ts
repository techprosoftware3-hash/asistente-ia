import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const getOpenRouter = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
};

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
     supabase.from("memories").select("content").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(5),
      supabase.from("employees").select("id, name, role").eq("user_id", ownerId).neq("id", employeeId),
      supabase.from("global_memories").select("title, content, category").eq("user_id", ownerId).limit(10),
      supabase.from("files").select("title, file_type, created_at").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(1),
      supabase.from("employee_documents").select("title, file_url, file_type, extracted_text").eq("employee_id", employeeId).limit(3),
      supabase.from("messages").select("role, content").eq("employee_id", employeeId).order("created_at", { ascending: true }).limit(5)
      
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
    
    // Texto de los compañeros de trabajo
    const colleaguesText = (colleaguesRes.data ?? [])
      .map((c) => `- ${c.name} (${c.role})`)
      .join("\n");
    
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

👥 COMPAÑEROS DE TRABAJO (Puedes delegar tareas y colaborar con ellos):
${colleaguesText || "No tienes compañeros asignados todavía."}

📁 DOCUMENTOS E IMÁGENES ADJUNTOS EN TU MEMORIA (Si el usuario te pide un archivo, manual o foto, compárteme el enlace markdown correspondiente):
${employeeDocsText || "No hay documentos ni fotos cargados todavía."}

🤝 IMPORTANT - CUANDO NO TENGAS INFORMACIÓN:
- Si el usuario te pregunta sobre información que NO tienes en tu memoria, PRIMERO responde explicando que no tienes esa información.
- Explica tu rol/puesto para dar contexto.
- LUEGO pregunta al usuario: "¿Querés que le pregunte a mi compañero [NOMBRE DEL COMPAÑERO APROPIADO SEGÚN SU ROL]?"
- ESPERA la respuesta del usuario. Si el usuario responde "sí" o confirma, ENTONCES usa la función delegate_task para consultar al compañero.
- Por ejemplo: si te preguntan sobre "nuevos ingresos" y no tienes esa info, responde: "No tengo información sobre nuevos ingresos en mi memoria actual. Mi rol es [TU ROL]. ¿Querés que le pregunte a Mateo (Especialista en Reclutamiento)?" → Si el usuario dice sí, usa delegate_task.
- Si te preguntan sobre "computadoras" o "sistemas" y no tienes esa info, responde: "No tengo información sobre el inventario de computadoras en mi memoria actual. Mi rol es [TU ROL]. ¿Querés que le pregunte a HASSAN (Asistente virtual soporte IT)?" → Si el usuario dice sí, usa delegate_task.`;

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
          description: `Delega explícitamente una tarea a otro colega. Compañeros disponibles: ${(colleaguesRes.data ?? []).map(c => `${c.name} (${c.role})`).join(", ")}. Debes usar el nombre exacto del compañero.`,
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

    const openrouter = getOpenRouter();
    const response = await openrouter.chat.completions.create({
      model: MODEL_NAME,
      messages,
      tools,
      tool_choice: "auto",
      max_tokens: 2000,
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

          if (functionName === "delegate_task") {
            // Buscar el empleado objetivo por nombre
            const targetName = functionArgs.target_employee_name;
            const { data: targetEmployee } = await supabase
              .from("employees")
              .select("id, name, role")
              .eq("user_id", ownerId)
              .ilike("name", `%${targetName}%`)
              .single();

            if (targetEmployee) {
              // Consultar la memoria del compañero y conocimientos globales relacionados
              const [targetMemoriesRes, targetGlobalMemoriesRes] = await Promise.all([
                supabase.from("memories").select("content").eq("employee_id", targetEmployee.id).order("created_at", { ascending: false }).limit(5),
                supabase.from("global_memories").select("title, content, category").eq("user_id", ownerId).limit(10)
              ]);

              const targetMemoriesText = (targetMemoriesRes.data ?? []).map((m) => `- ${m.content}`).join("\n");
              const targetGlobalMemoriesText = (targetGlobalMemoriesRes.data ?? [])
                .map((g) => `- [${g.category || 'General'}] ${g.title}: ${g.content}`)
                .join("\n");

              // Usar la IA para buscar respuesta en la memoria del compañero
              const queryOpenRouter = getOpenRouter();
              const queryResponse = await queryOpenRouter.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                  {
                    role: "system",
                    content: `Sos ${targetEmployee.name}, un empleado virtual con rol: ${targetEmployee.role}. 
Memoria específica: ${targetMemoriesText || "Ninguna"}
Conocimientos globales: ${targetGlobalMemoriesText || "Ningunos"}

Responde brevemente y de forma directa a la pregunta del usuario basándote SOLO en tu memoria y conocimientos disponibles. 
Si NO tienes la información específica, responde honestamente que no dispones de esos datos en tu memoria actual.`
                  },
                  {
                    role: "user",
                    content: functionArgs.description || message
                  }
                ],
                max_tokens: 300,
                temperature: 0.3
              });

              const colleagueResponse = queryResponse.choices[0]?.message?.content || "No tengo esa información en mi memoria actual.";

              // Crear la tarea para el empleado objetivo (para registro)
              await supabase.from("tasks").insert({
                employee_id: targetEmployee.id,
                title: functionArgs.title || "Consulta delegada",
                description: functionArgs.description || message,
                status: "completed"
              });

              // Responder al usuario con la información del compañero
              const toolMsg = `\n\n🤝 **Consulté a mi compañero ${targetEmployee.name}** y me dijo:\n\n${colleagueResponse}`;
              fullAssistantMessage += toolMsg;
              controller.enqueue(encoder.encode(toolMsg));
              actionTypeDesc = "delegate_task";
            } else {
              const toolMsg = `\n\n❌ **No se pudo delegar la tarea**\nNo encontré al compañero "${targetName}". Por favor, verifica el nombre exacto de tu compañero.`;
              fullAssistantMessage += toolMsg;
              controller.enqueue(encoder.encode(toolMsg));
            }
          }
          else if (functionName === "create_task") {
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