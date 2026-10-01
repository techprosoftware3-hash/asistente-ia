import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeEmployeeAction } from "@/lib/actions";
import { getAvailableTools } from "@/lib/tools/registry";

const getOpenRouter = () => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
};

type Frequency = "once" | "daily" | "weekly";

type GeneratedAction = {
  type: string;
  [key: string]: unknown;
};

type GeneratedResponse = {
  result: string;
  actions: GeneratedAction[];
  done: boolean;
};

const MAX_AGENT_STEPS = 8;
const DEFAULT_RETRY_AFTER_SECONDS = 120;

/**
 * Calcula próxima ejecución para tareas recurrentes.
 */
function calculateNextRun(
  current: string,
  frequency: Frequency
): string | null {
  const date = new Date(current);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (frequency === "daily") {
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString();
  }

  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString();
  }

  return null;
}

/**
 * Detecta específicamente el error 402 de OpenRouter:
 * - in_flight_budget_exhausted
 * - openrouter_credits (falta de créditos / límite de saldo)
 */
function isOpenRouterInFlightBudgetError(
  error: any
): boolean {
  const status =
    error?.status ??
    error?.statusCode;

  const message =
    error?.message ||
    "";

  const reason =
    error?.metadata?.reason ||
    error?.error?.metadata?.reason ||
    "";

  const limitSource =
    error?.metadata?.limit_source ||
    error?.error?.metadata?.limit_source ||
    "";

  return (
    status === 402 &&
    (
      reason ===
        "in_flight_budget_exhausted" ||
      limitSource ===
        "openrouter_credits" ||
      message.includes(
        "in_flight_budget_exhausted"
      ) ||
      message.includes(
        "in-flight requests"
      ) ||
      message.includes(
        "in flight"
      ) ||
      message.includes(
        "requires more credits"
      )
    )
  );
}

/**
 * Extrae Retry-After si OpenRouter lo proporcionó.
 */
function getRetryAfterSeconds(
  error: any
): number {
  const value =
    error?.retryAfter ??
    error?.headers?.["retry-after"];

  const parsed =
    Number(value);

  if (
    Number.isFinite(parsed) &&
    parsed > 0
  ) {
    return Math.ceil(parsed);
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Reprograma una tarea que quedó en running
 * por un error temporal del proveedor.
 */
async function requeueTaskAfterTemporaryError(
  supabase: ReturnType<typeof createAdminClient>,
  taskId: string,
  errorMessage: string,
  retryAfterSeconds: number
) {
  const nextRun =
    new Date(
      Date.now() +
        retryAfterSeconds * 1000
    ).toISOString();

  const { error } =
    await supabase
      .from("tasks")
      .update({
        status: "pending",

        result:
          `Ejecución pausada temporalmente: ${errorMessage}. ` +
          `Se reintentará automáticamente.`,

        next_run_at:
          nextRun,
      })
      .eq("id", taskId)
      .eq("status", "running");

  if (error) {
    throw new Error(
      `No se pudo reprogramar la tarea: ${error.message}`
    );
  }

  console.log(
    `[AUTOMATION] Tarea ${taskId} reprogramada.`
  );

  console.log(
    `[AUTOMATION] Nuevo next_run_at: ${nextRun}`
  );
}

/**
 * Parsea respuesta JSON de la IA.
 */
function parseAIResponse(
  content: string
): GeneratedResponse {
  try {
    let cleaned =
      content
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();

    if (
      !cleaned.startsWith("{")
    ) {
      const firstBrace =
        cleaned.indexOf("{");

      const lastBrace =
        cleaned.lastIndexOf("}");

      if (
        firstBrace !== -1 &&
        lastBrace !== -1 &&
        lastBrace > firstBrace
      ) {
        cleaned =
          cleaned.slice(
            firstBrace,
            lastBrace + 1
          );
      }
    }

    const parsed =
      JSON.parse(cleaned);

    return {
      result:
        typeof parsed.result ===
        "string"
          ? parsed.result
          : cleaned,

      actions:
        Array.isArray(
          parsed.actions
        )
          ? parsed.actions
          : [],

      done:
        typeof parsed.done ===
        "boolean"
          ? parsed.done
          : false,
    };
  } catch {
    console.warn(
      "[AUTOMATION] La IA no devolvió JSON válido."
    );

    return {
      result: content,
      actions: [],
      done: true,
    };
  }
}

/**
 * Valida que la IA solo utilice herramientas habilitadas.
 */
function validateActions(
  actions: GeneratedAction[],
  availableTools: ReturnType<
    typeof getAvailableTools
  >
) {
  return actions.filter(
    (action) => {
      if (
        !action ||
        typeof action !==
          "object"
      ) {
        return false;
      }

      if (
        typeof action.type !==
        "string"
      ) {
        console.warn(
          "[AUTOMATION] Acción rechazada porque no tiene un type válido."
        );

        return false;
      }

      const toolIsAvailable =
        availableTools.some(
          (tool) =>
            tool.name ===
            action.type
        );

      if (!toolIsAvailable) {
        console.warn(
          `[AUTOMATION] Acción rechazada: "${action.type}" no está habilitada.`
        );

        return false;
      }

      return true;
    }
  );
}

export async function runAutomationForUser(
  userId: string
) {
  const supabase =
    createAdminClient();

  console.log(
    "========================================"
  );

  console.log(
    `[AUTOMATION] Iniciando automatización para usuario: ${userId}`
  );

  const {
    data: employees,
    error: employeesError,
  } =
    await supabase
      .from("employees")
      .select("*")
      .eq(
        "user_id",
        userId
      );

  if (employeesError) {
    throw new Error(
      `Error obteniendo empleados: ${employeesError.message}`
    );
  }

  console.log(
    `[AUTOMATION] Empleados encontrados: ${
      employees?.length ?? 0
    }`
  );

  // ==========================================
  // CONOCIMIENTO GLOBAL DE LA EMPRESA
  // ==========================================
  const { data: globalMemories, error: globalMemError } = await supabase
    .from("global_memories")
    .select("title, content, category, importance")
    .eq("user_id", userId)
    .order("importance", { ascending: false });

  if (globalMemError) {
    console.error(
      `[AUTOMATION] Error obteniendo conocimiento global: ${globalMemError.message}`
    );
  }

  const globalMemoryContext =
    globalMemories
      ?.map(
        (gm) =>
          `[${gm.category.toUpperCase()}] ${gm.title} (Importancia: ${gm.importance}/5):\n${gm.content}`
      )
      .join("\n\n") || "No hay directrices globales registradas en la empresa.";

  let executed = 0;

  for (
    const employee of
    employees ?? []
  ) {
    console.log(
      "----------------------------------------"
    );

    console.log(
      `[AUTOMATION] Revisando empleado: ${employee.name}`
    );

    console.log(
      `[AUTOMATION] employeeId: ${employee.id}`
    );

    const now =
      new Date();

    const nowIso =
      now.toISOString();

    // ==========================================
    // COLEGAS (Para delegación de tareas)
    // ==========================================
    const colleagues = (employees ?? []).filter(
      (emp) => emp.id !== employee.id
    );

    const colleaguesContext =
      colleagues.length > 0
        ? colleagues
            .map(
              (colleague) =>
                `- Nombre: ${colleague.name} | Rol: ${colleague.role} | ID (target_employee_id): ${colleague.id}`
            )
            .join("\n")
        : "No hay otros empleados en la empresa.";

    // ==========================================
    // TOOL REGISTRY
    // ==========================================

    const registryTools =
      getAvailableTools();

    // ==========================================
    // HERRAMIENTAS HABILITADAS
    // ==========================================

    const {
      data: enabledTools,
      error: toolsError,
    } =
      await supabase
        .from("employee_tools")
        .select("tool_name")
        .eq(
          "employee_id",
          employee.id
        )
        .eq(
          "enabled",
          true
        );

    if (toolsError) {
      console.error(
        `[AUTOMATION] Error obteniendo herramientas: ${toolsError.message}`
      );

      continue;
    }

    const availableTools =
      registryTools.filter(
        (tool) =>
          (
            enabledTools ??
            []
          ).some(
            (enabledTool) =>
              enabledTool.tool_name ===
              tool.name
          )
      );

    // ==========================================
    // MEMORIA
    // ==========================================

    const {
      data: memories,
      error: memoriesError,
    } =
      await supabase
        .from("memories")
        .select(
          "id, content, type, importance, is_permanent, expires_at, source, created_at"
        )
        .eq(
          "employee_id",
          employee.id
        )
        .or(
          `is_permanent.eq.true,expires_at.is.null,expires_at.gt.${nowIso}`
        )
        .order(
          "importance",
          {
            ascending:
              false,
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(3);

    if (memoriesError) {
      console.error(
        `[AUTOMATION] Error obteniendo memoria: ${memoriesError.message}`
      );

      continue;
    }

    const memoryContext =
      memories
        ?.map(
          (memory) =>
            `ID: ${memory.id}
Tipo: ${memory.type}
Importancia: ${memory.importance}
Permanente: ${memory.is_permanent}
Contenido: ${memory.content}`
        )
        .join(
          "\n\n"
        ) ||
      "No hay memoria relevante.";

    // ==========================================
    // TAREAS AUTOMATIZADAS
    // ==========================================

    const {
      data: tasks,
      error: tasksError,
    } =
      await supabase
        .from("tasks")
        .select("*")
        .eq(
          "employee_id",
          employee.id
        )
        .eq(
          "is_automated",
          true
        )
        .eq(
          "status",
          "pending"
        )
        .lte(
          "next_run_at",
          nowIso
        )
        .order(
          "next_run_at",
          {
            ascending:
              true,
          }
        );

    if (tasksError) {
      console.error(
        `[AUTOMATION] Error obteniendo tareas: ${tasksError.message}`
      );

      continue;
    }

    // ==========================================
    // EJECUTAR TAREAS
    // ==========================================

    for (
      const task of
      tasks ?? []
    ) {
      console.log(
        "----------------------------------------"
      );

      console.log(
        `[AUTOMATION] Ejecutando tarea: ${task.title}`
      );

      const {
        data: claimedTask,
        error: claimError,
      } =
        await supabase
          .from("tasks")
          .update({
            status:
              "running",

            started_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            task.id
          )
          .eq(
            "status",
            "pending"
          )
          .select()
          .single();

      if (
        claimError ||
        !claimedTask
      ) {
        continue;
      }

      const toolsContext =
        availableTools.length >
        0
          ? availableTools
              .map(
                (tool) =>
                  `- ${tool.name}: ${tool.description}`
              )
              .join(
                "\n"
              )
          : "Ninguna herramienta habilitada.";

      const agentHistory:
        string[] = [];

      let finalResult =
        "La tarea no produjo un resultado.";

      let taskCompleted =
        false;

      let taskRequeued =
        false;

      for (
        let step = 1;
        step <=
        MAX_AGENT_STEPS;
        step++
      ) {
        const currentTime =
          new Date().toISOString();

        const prompt = `
Sos un empleado digital autónomo.

IDENTIDAD

Nombre:
${employee.name}

Rol:
${employee.role}

OBJETIVO

${employee.objective}

PERSONALIDAD

${
  employee.personality ||
  "Profesional, claro y eficiente."
}

INSTRUCCIONES

${
  employee.instructions ||
  "Realizá la tarea de la mejor manera posible."
}

REGLAS

${JSON.stringify(
  employee.rules || []
)}

CONOCIMIENTO GLOBAL DE LA EMPRESA (Políticas y directrices oficiales)

${globalMemoryContext}

COMPAÑEROS DE EQUIPO (Para delegar tareas con delegate_task)

${colleaguesContext}

HERRAMIENTAS HABILITADAS

${toolsContext}

REGLA FUNDAMENTAL SOBRE HERRAMIENTAS

Solo podés utilizar herramientas que aparezcan en
HERRAMIENTAS HABILITADAS.

No inventes herramientas.

MEMORIA RELEVANTE

${memoryContext}

HISTORIAL DE EJECUCIÓN DE ESTA TAREA

${
  agentHistory.length >
  0
    ? agentHistory.join(
        "\n\n"
      )
    : "Todavía no se ejecutó ninguna herramienta."
}

TAREA ACTUAL

Título:
${task.title}

Descripción:
${task.description || "Sin descripción."}

FECHA Y HORA ACTUAL

${currentTime}

OBJETIVO

Completá la tarea utilizando las herramientas disponibles y el conocimiento corporativo global.

REGLAS IMPORTANTES

- No inventes información.
- No inventes resultados de herramientas.
- No inventes IDs.
- No inventes datos de prospectos.
- Conservá información existente cuando actualices datos.
- Respeta siempre las directrices de la Base de Conocimiento Global de la Empresa.
- Utilizá únicamente herramientas habilitadas.
- No hagas acciones innecesarias.
- Si una herramienta devuelve datos, utilizá esos datos como fuente de verdad.
- Si una acción falla, analizá el error antes de decidir qué hacer.
- No repitas una herramienta innecesariamente.
- NO vuelvas a consultar datos que una herramienta de escritura ya confirmó correctamente, salvo que la tarea pida explícitamente verificar.
- Después de una acción de escritura exitosa, si el objetivo de la tarea ya fue cumplido, terminá la tarea con done=true.
- Si la tarea ya está completa, no propongas más acciones.
- Si no hace falta ninguna herramienta y la tarea está completa, devolvé actions=[] y done=true.

FORMATO OBLIGATORIO

Respondé ÚNICAMENTE JSON válido:

{
  "result": "resumen del estado actual",
  "actions": [],
  "done": false
}

Para solicitar una herramienta:

{
  "result": "Necesito consultar los prospectos.",
  "actions": [
    {
      "type": "get_leads"
    }
  ],
  "done": false
}

Para terminar:

{
  "result": "Se completó la tarea.",
  "actions": [],
  "done": true
}
`;

        try {
          const openrouter = getOpenRouter();
          const response =
            await openrouter.chat.completions.create(
              {
                model:
                  process.env.OPENROUTER_MODEL ||
                  "openai/gpt-5.6",

                max_tokens: 60,

                temperature: 0.2,

                messages: [
                  {
                    role: "system",
                    content:
                      "Sos un empleado digital autónomo. Respondé únicamente JSON válido.",
                  },
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
              }
            );

          const content =
            response
              .choices[0]
              ?.message
              ?.content;

          if (!content) {
            throw new Error(
              "OpenRouter no devolvió contenido."
            );
          }

          const generated =
            parseAIResponse(
              content
            );

          finalResult =
            generated.result;

          const validActions =
            validateActions(
              generated.actions,
              availableTools
            );

          if (
            generated.done &&
            validActions.length === 0
          ) {
            taskCompleted = true;
            break;
          }

          if (validActions.length === 0) {
            if (generated.done) {
              taskCompleted = true;
            }
            break;
          }

          for (
            const action of
            validActions
          ) {
            try {
              const actionResult =
                await executeEmployeeAction(
                  {
                    employeeId:
                      employee.id,

                    taskId:
                      task.id,

                    action,
                  }
                );

              agentHistory.push(
                `PASO ${step}
ACCIÓN:
${JSON.stringify(
  action,
  null,
  2
)}

RESULTADO:
${JSON.stringify(
  actionResult,
  null,
  2
)}`
              );

              await supabase
                .from(
                  "action_logs"
                )
                .insert({
                  employee_id:
                    employee.id,

                  task_id:
                    task.id,

                  action_type:
                    action.type,

                  status:
                    "success",

                  input:
                    action,

                  output:
                    actionResult,
                });

              const isWriteAction =
                action.type ===
                  "update_lead" ||
                action.type ===
                  "create_lead" ||
                action.type ===
                  "update_memory" ||
                action.type ===
                  "delegate_task";

              if (
                isWriteAction &&
                generated.done
              ) {
                taskCompleted = true;
              }
            } catch (
              actionError
            ) {
              const errorMessage =
                actionError instanceof
                Error
                  ? actionError.message
                  : "Error desconocido.";

              agentHistory.push(
                `PASO ${step}
ACCIÓN:
${JSON.stringify(
  action,
  null,
  2
)}

RESULTADO:
ERROR

${errorMessage}`
              );

              await supabase
                .from(
                  "action_logs"
                )
                .insert({
                  employee_id:
                    employee.id,

                  task_id:
                    task.id,

                  action_type:
                    action.type,

                  status:
                    "failed",

                  input:
                    action,

                  error:
                    errorMessage,
                });
            }
          }

          if (taskCompleted) {
            break;
          }
        } catch (
          error: any
        ) {
          if (
            isOpenRouterInFlightBudgetError(
              error
            )
          ) {
            const retryAfter =
              getRetryAfterSeconds(
                error
              );

            try {
              await requeueTaskAfterTemporaryError(
                supabase,
                task.id,
                error.message ||
                  "Límite temporal de requests de OpenRouter.",
                retryAfter
              );

              taskRequeued = true;
            } catch (
              requeueError
            ) {
              throw requeueError;
            }

            break;
          }

          throw error;
        }
      }

      if (taskRequeued) {
        continue;
      }

      if (!taskCompleted) {
        const failedAt =
          new Date().toISOString();

        await supabase
          .from("tasks")
          .update({
            status:
              "failed",

            result:
              `${finalResult}\n\nEl agente alcanzó el límite de ${MAX_AGENT_STEPS} pasos sin indicar que la tarea estuviera completa.`,

            completed_at:
              failedAt,
          })
          .eq(
            "id",
            task.id
          )
          .eq(
            "status",
            "running"
          );

        continue;
      }

      const memoryContent =
        `Resultado de la tarea "${task.title}":\n${finalResult}`;

      await supabase
        .from("memories")
        .insert({
          employee_id:
            employee.id,

          content:
            memoryContent,

          type:
            "task_result",

          importance: 2,

          is_permanent: false,

          source:
            "automation",

          expires_at:
            new Date(
              Date.now() +
                1000 *
                  60 *
                  60 *
                  24 *
                  30
            ).toISOString(),
        });

      const frequency:
        Frequency =
        task.frequency ===
          "daily" ||
        task.frequency ===
          "weekly"
          ? task.frequency
          : "once";

      const completedAt =
        new Date().toISOString();

      if (
        frequency ===
        "once"
      ) {
        await supabase
          .from("tasks")
          .update({
            status:
              "completed",

            result:
              finalResult,

            completed_at:
              completedAt,

            last_run_at:
              completedAt,

            next_run_at:
              null,
          })
          .eq(
            "id",
            task.id
          )
          .eq(
            "status",
            "running"
          );
      } else {
        let nextRun =
          calculateNextRun(
            task.next_run_at ||
              nowIso,
            frequency
          );

        while (
          nextRun &&
          new Date(
            nextRun
          ) <=
            new Date()
        ) {
          nextRun =
            calculateNextRun(
              nextRun,
              frequency
            );
        }

        if (
          !nextRun
        ) {
          throw new Error(
            "No se pudo calcular la próxima ejecución."
          );
        }

        await supabase
          .from("tasks")
          .update({
            status:
              "pending",

            result:
              finalResult,

            completed_at:
              completedAt,

            last_run_at:
              completedAt,

            next_run_at:
              nextRun,
          })
          .eq(
            "id",
            task.id
          )
          .eq(
            "status",
            "running"
          );
      }

      executed++;
    }
  }

  return {
    executed,
  };
}

export async function runAutomationForAllUsers() {
  const supabase =
    createAdminClient();

  const {
    data: employees,
    error,
  } =
    await supabase
      .from("employees")
      .select("user_id");

  if (error) {
    throw new Error(
      `Error obteniendo usuarios: ${error.message}`
    );
  }

  const userIds = [
    ...new Set(
      (
        employees ??
        []
      ).map(
        (employee) =>
          employee.user_id
      )
    ),
  ];

  let totalExecuted =
    0;

  for (
    const userId of
    userIds
  ) {
    try {
      const result =
        await runAutomationForUser(
          userId
        );

      totalExecuted +=
        result.executed;
    } catch (
      error
    ) {
      console.error(
        `[AUTOMATION] Error procesando usuario ${userId}:`,
        error
      );
    }
  }

  return {
    executed:
      totalExecuted,
  };
}