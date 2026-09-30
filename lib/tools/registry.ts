import { createAdminClient } from "@/lib/supabase/admin";

type ToolContext = {
  employeeId: string;
  taskId?: string | null;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    input: Record<string, unknown>,
    context: ToolContext
  ) => Promise<unknown>;
};

const createTaskTool: ToolDefinition = {
  name: "create_task",

  description:
    "Crea una tarea para el empleado. Parámetros: title (string obligatorio), description (string opcional) y scheduled_at (fecha ISO 8601 opcional).",

  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Título de la tarea.",
      },
      description: {
        type: "string",
        description: "Descripción de la tarea.",
      },
      scheduled_at: {
        type: "string",
        description: "Fecha y hora programada en formato ISO 8601.",
      },
    },
    required: ["title"],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const title =
      typeof input.title === "string" ? input.title.trim() : "";

    const description =
      typeof input.description === "string"
        ? input.description.trim()
        : "";

    const scheduledAt =
      typeof input.scheduled_at === "string"
        ? input.scheduled_at
        : null;

    if (!title) {
      throw new Error("El título de la tarea es obligatorio.");
    }

    if (title.length > 200) {
      throw new Error(
        "El título de la tarea no puede superar los 200 caracteres."
      );
    }

    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(
          "scheduled_at debe ser una fecha ISO 8601 válida."
        );
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        employee_id: context.employeeId,
        title,
        description,
        status: "pending",
        is_automated: false,
        frequency: "once",
        scheduled_at: scheduledAt,
        next_run_at: scheduledAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        `No se pudo crear la tarea: ${error.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "create_task",
      status: "executed",
      input,
      output: task,
    });

    return {
      task_id: task.id,
      title: task.title,
      scheduled_at: task.scheduled_at,
      status: task.status,
    };
  },
};

const updateMemoryTool: ToolDefinition = {
  name: "update_memory",

  description:
    "Crea una memoria nueva o actualiza una memoria existente. Parámetros: content (string obligatorio), memory_id (UUID opcional para actualizar una memoria existente), type (string opcional), importance (número de 1 a 5), is_permanent (boolean) y expires_at (fecha ISO 8601 opcional). Si memory_id existe, actualiza esa memoria. Si no existe, crea una nueva.",

  inputSchema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "Contenido de la memoria.",
      },
      memory_id: {
        type: "string",
        description:
          "ID de una memoria existente que debe actualizarse.",
      },
      type: {
        type: "string",
        description: "Tipo de memoria.",
      },
      importance: {
        type: "number",
        description: "Importancia de 1 a 5.",
      },
      is_permanent: {
        type: "boolean",
        description:
          "Indica si la memoria debe conservarse permanentemente.",
      },
      expires_at: {
        type: "string",
        description:
          "Fecha ISO 8601 en la que expira la memoria.",
      },
    },
    required: ["content"],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const content =
      typeof input.content === "string"
        ? input.content.trim()
        : "";

    const memoryId =
      typeof input.memory_id === "string"
        ? input.memory_id.trim()
        : null;

    const type =
      typeof input.type === "string" && input.type.trim()
        ? input.type.trim()
        : "general";

    const rawImportance =
      typeof input.importance === "number"
        ? input.importance
        : 3;

    const importance = Math.min(
      5,
      Math.max(1, Math.round(rawImportance))
    );

    const isPermanent =
      typeof input.is_permanent === "boolean"
        ? input.is_permanent
        : false;

    const expiresAt =
      typeof input.expires_at === "string"
        ? input.expires_at
        : null;

    if (!content) {
      throw new Error(
        "El contenido de la memoria es obligatorio."
      );
    }

    if (content.length > 5000) {
      throw new Error(
        "El contenido de la memoria no puede superar los 5000 caracteres."
      );
    }

    if (expiresAt) {
      const parsedDate = new Date(expiresAt);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error(
          "expires_at debe ser una fecha ISO 8601 válida."
        );
      }
    }

    if (memoryId) {
      const { data: existingMemory, error: findError } =
        await supabase
          .from("memories")
          .select("id, employee_id")
          .eq("id", memoryId)
          .eq("employee_id", context.employeeId)
          .maybeSingle();

      if (findError) {
        throw new Error(
          `No se pudo buscar la memoria: ${findError.message}`
        );
      }

      if (!existingMemory) {
        throw new Error(
          "La memoria indicada no existe para este empleado."
        );
      }

      const { data: updatedMemory, error: updateError } =
        await supabase
          .from("memories")
          .update({
            content,
            type,
            importance,
            is_permanent: isPermanent,
            expires_at: expiresAt,
            source: "tool:update_memory",
          })
          .eq("id", memoryId)
          .eq("employee_id", context.employeeId)
          .select()
          .single();

      if (updateError) {
        throw new Error(
          `No se pudo actualizar la memoria: ${updateError.message}`
        );
      }

      await supabase.from("action_logs").insert({
        employee_id: context.employeeId,
        task_id: context.taskId ?? null,
        action_type: "update_memory",
        status: "executed",
        input,
        output: {
          operation: "updated",
          memory_id: updatedMemory.id,
          content: updatedMemory.content,
        },
      });

      return {
        memory_id: updatedMemory.id,
        operation: "updated",
        content: updatedMemory.content,
        type: updatedMemory.type,
        importance: updatedMemory.importance,
        is_permanent: updatedMemory.is_permanent,
        expires_at: updatedMemory.expires_at,
      };
    }

    const { data: newMemory, error: insertError } =
      await supabase
        .from("memories")
        .insert({
          employee_id: context.employeeId,
          content,
          type,
          importance,
          is_permanent: isPermanent,
          expires_at: expiresAt,
          source: "tool:update_memory",
        })
        .select()
        .single();

    if (insertError) {
      throw new Error(
        `No se pudo crear la memoria: ${insertError.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "update_memory",
      status: "executed",
      input,
      output: {
        operation: "created",
        memory_id: newMemory.id,
        content: newMemory.content,
      },
    });

    return {
      memory_id: newMemory.id,
      operation: "created",
      content: newMemory.content,
      type: newMemory.type,
      importance: newMemory.importance,
      is_permanent: newMemory.is_permanent,
      expires_at: newMemory.expires_at,
    };
  },
};

const getLeadsTool: ToolDefinition = {
  name: "get_leads",

  description:
    'Consulta los prospectos comerciales del empleado. Puede filtrar por prioridad, estado y cantidad. Usala cuando necesites revisar, analizar o priorizar leads existentes.',

  inputSchema: {
    type: "object",
    properties: {
      priority: {
        type: "string",
        enum: ["cold", "warm", "hot"],
        description: "Filtra por prioridad comercial.",
      },
      status: {
        type: "string",
        description: "Filtra por estado del prospecto.",
      },
      limit: {
        type: "number",
        description:
          "Cantidad máxima de prospectos a devolver. Máximo 50.",
      },
    },
    required: [],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const priority =
      typeof input.priority === "string"
        ? input.priority.trim()
        : null;

    const status =
      typeof input.status === "string"
        ? input.status.trim()
        : null;

    const rawLimit =
      typeof input.limit === "number"
        ? input.limit
        : 20;

    const limit = Math.min(
      50,
      Math.max(1, Math.round(rawLimit))
    );

    if (
      priority &&
      !["cold", "warm", "hot"].includes(priority)
    ) {
      throw new Error(
        "La prioridad debe ser cold, warm o hot."
      );
    }

    let query = supabase
      .from("leads")
      .select(
        `
        id,
        name,
        phone,
        email,
        interest,
        location,
        property_type,
        budget,
        timeline_days,
        priority,
        status,
        notes,
        created_at,
        updated_at
        `
      )
      .eq("employee_id", context.employeeId)
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (priority) {
      query = query.eq("priority", priority);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: leads, error } = await query;

    if (error) {
      throw new Error(
        `No se pudieron consultar los prospectos: ${error.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "get_leads",
      status: "executed",
      input,
      output: {
        count: leads?.length ?? 0,
        leads: leads ?? [],
      },
    });

    return {
      count: leads?.length ?? 0,
      leads: leads ?? [],
    };
  },
};

const createLeadTool: ToolDefinition = {
  name: "create_lead",

  description:
    "Registra un nuevo prospecto comercial en el sistema. Usala cuando aparezca información suficiente sobre una persona interesada en comprar, alquilar o consultar por una propiedad. Parámetros: name obligatorio; phone, email, interest, location, property_type, budget, timeline_days, priority, status y notes opcionales.",

  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Nombre del prospecto.",
      },
      phone: {
        type: "string",
        description: "Teléfono del prospecto.",
      },
      email: {
        type: "string",
        description: "Email del prospecto.",
      },
      interest: {
        type: "string",
        description:
          "Qué está buscando o qué propiedad le interesa.",
      },
      location: {
        type: "string",
        description: "Zona o localidad de interés.",
      },
      property_type: {
        type: "string",
        description: "Tipo de propiedad buscada.",
      },
      budget: {
        type: "number",
        description: "Presupuesto aproximado.",
      },
      timeline_days: {
        type: "number",
        description:
          "Cantidad aproximada de días hasta la compra o decisión.",
      },
      priority: {
        type: "string",
        enum: ["cold", "warm", "hot"],
        description:
          "Prioridad comercial del prospecto.",
      },
      status: {
        type: "string",
        description:
          "Estado actual del prospecto.",
      },
      notes: {
        type: "string",
        description:
          "Información adicional relevante.",
      },
    },
    required: ["name"],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    if (!name) {
      throw new Error(
        "El nombre del prospecto es obligatorio."
      );
    }

    if (name.length > 200) {
      throw new Error(
        "El nombre del prospecto no puede superar los 200 caracteres."
      );
    }

    const phone =
      typeof input.phone === "string"
        ? input.phone.trim()
        : null;

    const email =
      typeof input.email === "string"
        ? input.email.trim()
        : null;

    const interest =
      typeof input.interest === "string"
        ? input.interest.trim()
        : null;

    const location =
      typeof input.location === "string"
        ? input.location.trim()
        : null;

    const propertyType =
      typeof input.property_type === "string"
        ? input.property_type.trim()
        : null;

    const budget =
      typeof input.budget === "number" &&
      Number.isFinite(input.budget)
        ? input.budget
        : null;

    const timelineDays =
      typeof input.timeline_days === "number" &&
      Number.isFinite(input.timeline_days)
        ? Math.max(0, Math.round(input.timeline_days))
        : null;

    const allowedPriorities = [
      "cold",
      "warm",
      "hot",
    ];

    const priority =
      typeof input.priority === "string" &&
      allowedPriorities.includes(input.priority)
        ? input.priority
        : "warm";

    const status =
      typeof input.status === "string" &&
      input.status.trim()
        ? input.status.trim()
        : "new";

    const notes =
      typeof input.notes === "string"
        ? input.notes.trim()
        : null;

    const { data: employee, error: employeeError } =
      await supabase
        .from("employees")
        .select("id, user_id")
        .eq("id", context.employeeId)
        .single();

    if (employeeError || !employee) {
      throw new Error(
        "No se pudo verificar el empleado."
      );
    }

    const { data: lead, error: leadError } =
      await supabase
        .from("leads")
        .insert({
          user_id: employee.user_id,
          employee_id: context.employeeId,
          name,
          phone,
          email,
          interest,
          location,
          property_type: propertyType,
          budget,
          timeline_days: timelineDays,
          priority,
          status,
          notes,
        })
        .select()
        .single();

    if (leadError) {
      throw new Error(
        `No se pudo crear el prospecto: ${leadError.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "create_lead",
      status: "executed",
      input,
      output: lead,
    });

    return {
      lead_id: lead.id,
      name: lead.name,
      priority: lead.priority,
      status: lead.status,
    };
  },
};

const updateLeadTool: ToolDefinition = {
  name: "update_lead",

  description:
    "Actualiza un prospecto comercial existente. Usala cuando necesites cambiar su estado, prioridad, notas, presupuesto, plazo, interés, ubicación u otros datos comerciales. Requiere lead_id. Solo modifica los campos enviados.",

  inputSchema: {
    type: "object",
    properties: {
      lead_id: {
        type: "string",
        description:
          "UUID del prospecto existente.",
      },
      name: {
        type: "string",
        description:
          "Nombre actualizado del prospecto.",
      },
      phone: {
        type: "string",
        description:
          "Teléfono actualizado.",
      },
      email: {
        type: "string",
        description:
          "Email actualizado.",
      },
      interest: {
        type: "string",
        description:
          "Interés o búsqueda actualizada.",
      },
      location: {
        type: "string",
        description:
          "Ubicación o zona de interés actualizada.",
      },
      property_type: {
        type: "string",
        description:
          "Tipo de propiedad actualizado.",
      },
      budget: {
        type: "number",
        description:
          "Presupuesto actualizado.",
      },
      timeline_days: {
        type: "number",
        description:
          "Cantidad de días hasta la compra o decisión.",
      },
      priority: {
        type: "string",
        enum: ["cold", "warm", "hot"],
        description:
          "Nueva prioridad comercial.",
      },
      status: {
        type: "string",
        description:
          "Nuevo estado del prospecto.",
      },
      notes: {
        type: "string",
        description:
          "Notas comerciales actualizadas.",
      },
    },
    required: ["lead_id"],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const leadId =
      typeof input.lead_id === "string"
        ? input.lead_id.trim()
        : "";

    if (!leadId) {
      throw new Error(
        "lead_id es obligatorio."
      );
    }

    const { data: existingLead, error: findError } =
      await supabase
        .from("leads")
        .select("id, employee_id")
        .eq("id", leadId)
        .eq("employee_id", context.employeeId)
        .maybeSingle();

    if (findError) {
      throw new Error(
        `No se pudo buscar el prospecto: ${findError.message}`
      );
    }

    if (!existingLead) {
      throw new Error(
        "El prospecto indicado no existe para este empleado."
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof input.name === "string") {
      const value = input.name.trim();

      if (!value) {
        throw new Error(
          "El nombre no puede quedar vacío."
        );
      }

      if (value.length > 200) {
        throw new Error(
          "El nombre no puede superar los 200 caracteres."
        );
      }

      updates.name = value;
    }

    if (typeof input.phone === "string") {
      updates.phone = input.phone.trim();
    }

    if (typeof input.email === "string") {
      updates.email = input.email.trim();
    }

    if (typeof input.interest === "string") {
      updates.interest = input.interest.trim();
    }

    if (typeof input.location === "string") {
      updates.location = input.location.trim();
    }

    if (typeof input.property_type === "string") {
      updates.property_type =
        input.property_type.trim();
    }

    if (
      typeof input.budget === "number" &&
      Number.isFinite(input.budget)
    ) {
      updates.budget = input.budget;
    }

    if (
      typeof input.timeline_days === "number" &&
      Number.isFinite(input.timeline_days)
    ) {
      updates.timeline_days = Math.max(
        0,
        Math.round(input.timeline_days)
      );
    }

    if (typeof input.priority === "string") {
      if (
        !["cold", "warm", "hot"].includes(
          input.priority
        )
      ) {
        throw new Error(
          "La prioridad debe ser cold, warm o hot."
        );
      }

      updates.priority = input.priority;
    }

    if (typeof input.status === "string") {
      const value = input.status.trim();

      if (!value) {
        throw new Error(
          "El estado no puede quedar vacío."
        );
      }

      updates.status = value;
    }

    if (typeof input.notes === "string") {
      updates.notes = input.notes.trim();
    }

    if (Object.keys(updates).length === 0) {
      throw new Error(
        "No se indicó ningún campo para actualizar."
      );
    }

    const { data: updatedLead, error: updateError } =
      await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId)
        .eq("employee_id", context.employeeId)
        .select()
        .single();

    if (updateError) {
      throw new Error(
        `No se pudo actualizar el prospecto: ${updateError.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "update_lead",
      status: "executed",
      input,
      output: {
        lead: updatedLead,
        updated_fields: Object.keys(updates),
      },
    });

    return {
      lead_id: updatedLead.id,
      name: updatedLead.name,
      priority: updatedLead.priority,
      status: updatedLead.status,
      updated_fields: Object.keys(updates),
    };
  },
};

const delegateTaskTool: ToolDefinition = {
  name: "delegate_task",

  description:
    "Delega una subtarea específica a otro empleado digital de la empresa. Parámetros: target_employee_id (UUID del empleado destino, obligatorio), title (título breve, obligatorio) y description (instrucciones operativas detalladas, obligatorio).",

  inputSchema: {
    type: "object",
    properties: {
      target_employee_id: {
        type: "string",
        description: "UUID del empleado que recibirá la tarea.",
      },
      title: {
        type: "string",
        description: "Título breve de la tarea delegada.",
      },
      description: {
        type: "string",
        description: "Instrucciones operativas detalladas para el colega.",
      },
    },
    required: ["target_employee_id", "title", "description"],
  },

  async execute(input, context) {
    const supabase = createAdminClient();

    const targetEmployeeId =
      typeof input.target_employee_id === "string"
        ? input.target_employee_id.trim()
        : "";

    const title =
      typeof input.title === "string" ? input.title.trim() : "";

    const description =
      typeof input.description === "string"
        ? input.description.trim()
        : "";

    if (!targetEmployeeId || !title) {
      throw new Error(
        "target_employee_id y title son obligatorios para delegar una tarea."
      );
    }

    if (targetEmployeeId === context.employeeId) {
      throw new Error(
        "Un empleado no puede delegarse una tarea a sí mismo."
      );
    }

    // Validar que el empleado destino exista
    const { data: targetEmployee, error: targetError } =
      await supabase
        .from("employees")
        .select("id, name, user_id")
        .eq("id", targetEmployeeId)
        .single();

    if (targetError || !targetEmployee) {
      throw new Error(
        "El empleado de destino no existe o no es válido."
      );
    }

    // Crear la tarea para el empleado destino
    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        employee_id: targetEmployeeId,
        title: `[Delegado] ${title}`,
        description,
        status: "pending",
        is_automated: true,
        frequency: "once",
        next_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(
        `No se pudo delegar la tarea: ${insertError.message}`
      );
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "delegate_task",
      status: "executed",
      input,
      output: newTask,
    });

    return {
      success: true,
      message: `Tarea delegada exitosamente a ${targetEmployee.name}.`,
      task_id: newTask.id,
      target_employee: targetEmployee.name,
    };
  },
};

export const TOOL_REGISTRY: Record<
  string,
  ToolDefinition
> = {
  create_task: createTaskTool,
  update_memory: updateMemoryTool,
  get_leads: getLeadsTool,
  create_lead: createLeadTool,
  update_lead: updateLeadTool,
  delegate_task: delegateTaskTool,
};

export function getTool(name: string) {
  return TOOL_REGISTRY[name];
}

export function getAvailableTools() {
  return Object.values(TOOL_REGISTRY);
}
const getGlobalMemoriesTool: ToolDefinition = {
  name: "get_global_memories",
  description: "Consulta el conocimiento global de la empresa (políticas, catálogos, directrices o información corporativa transversal). Usala cuando necesites consultar información oficial de la empresa para realizar tu trabajo.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Categoría opcional para filtrar la búsqueda (ej: precios, politicas, proyectos)."
      }
    },
    required: []
  },
  async execute(input, context) {
    const supabase = createAdminClient();

    // Obtenemos el user_id a través del empleado actual
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", context.employeeId)
      .single();

    if (empError || !employee) {
      throw new Error("No se pudo verificar el usuario propietario del empleado.");
    }

    let query = supabase
      .from("global_memories")
      .select("id, title, content, category, importance")
      .eq("user_id", employee.user_id)
      .order("importance", { ascending: false });

    if (typeof input.category === "string" && input.category.trim()) {
      query = query.eq("category", input.category.trim());
    }

    const { data: memories, error } = await query;

    if (error) {
      throw new Error(`No se pudo consultar el conocimiento global: ${error.message}`);
    }

    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "get_global_memories",
      status: "executed",
      input,
      output: { count: memories?.length ?? 0, memories: memories ?? [] }
    });

    return {
      count: memories?.length ?? 0,
      global_memories: memories ?? []
    };
  }
};
const sendNotificationTool: ToolDefinition = {
  name: "send_notification",
  description: "Envía una notificación o mensaje saliente hacia un servicio externo o canal de comunicación (como WhatsApp, Slack, Discord o un webhook configurado). Parámetros: message (texto obligatorio del mensaje a enviar), channel (string opcional, ej: whatsapp, email, slack).",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "Contenido del mensaje o notificación a enviar.",
      },
      channel: {
        type: "string",
        description: "Canal de destino (ej: whatsapp, slack, webhook).",
      },
    },
    required: ["message"],
  },
  async execute(input, context) {
    const supabase = createAdminClient();

    const message =
      typeof input.message === "string" ? input.message.trim() : "";
    const channel =
      typeof input.channel === "string" ? input.channel.trim() : "webhook";

    if (!message) {
      throw new Error("El mensaje de notificación es obligatorio.");
    }

    // Opcional: Podés configurar una URL global de webhook para notificaciones salientes en tus variables de entorno (OUTBOUND_WEBHOOK_URL)
    const outboundUrl = process.env.OUTBOUND_WEBHOOK_URL;

    let externalResponse = null;

    if (outboundUrl) {
      try {
        const res = await fetch(outboundUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: context.employeeId,
            task_id: context.taskId ?? null,
            channel,
            message,
            timestamp: new Date().toISOString(),
          }),
        });
        externalResponse = await res.json().catch(() => ({ status: res.status }));
      } catch (fetchErr: any) {
        console.warn("[OUTBOUND] No se pudo despachar el webhook externo:", fetchErr.message);
      }
    }

    // Registrar la acción en los logs
    await supabase.from("action_logs").insert({
      employee_id: context.employeeId,
      task_id: context.taskId ?? null,
      action_type: "send_notification",
      status: "executed",
      input,
      output: { success: true, channel, message, externalResponse },
    });

    return {
      success: true,
      message: `Notificación enviada exitosamente vía ${channel}.`,
      content: message,
    };
  },
};