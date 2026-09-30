import { createAdminClient } from "@/lib/supabase/admin";
import { getTool } from "@/lib/tools/registry";
import { checkUserSubscription } from "@/lib/utils/subscription";

type EmployeeAction = {
  type: string;
  [key: string]: unknown;
};

type ExecuteActionParams = {
  employeeId: string;
  taskId?: string | null;
  action: EmployeeAction;
};

export async function executeEmployeeAction({
  employeeId,
  taskId = null,
  action,
}: ExecuteActionParams) {
  const supabase = createAdminClient();

  if (!action || typeof action !== "object") {
    throw new Error("La acción no es válida.");
  }

  if (!action.type || typeof action.type !== "string") {
    throw new Error("La acción no tiene un tipo válido.");
  }

  const toolName = action.type;

  console.log(
    `[ACTION] Verificando herramienta "${toolName}" para empleado ${employeeId}`
  );

  // 1. Verificar que el empleado exista y obtener su user_id
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .single();

  if (employeeError || !employee) {
    throw new Error("Empleado no encontrado.");
  }

  // 1.5. Verificar que el dueño del empleado tenga la suscripción o periodo de prueba activo
  const { isActive } = await checkUserSubscription(employee.user_id);
  if (!isActive) {
    throw new Error(
      "El periodo de prueba ha finalizado. Las acciones y chats de los empleados están bloqueados hasta realizar el pago de la suscripción."
    );
  }

  // 2. Verificar que la herramienta exista en el Tool Registry
  const tool = getTool(toolName);

  if (!tool) {
    throw new Error(
      `La herramienta "${toolName}" no está registrada en el Tool Registry.`
    );
  }

  // 3. Verificar que el empleado tenga permiso para usar la herramienta
  const { data: permission, error: permissionError } =
    await supabase
      .from("employee_tools")
      .select("id, tool_name, enabled")
      .eq("employee_id", employeeId)
      .eq("tool_name", toolName)
      .eq("enabled", true)
      .maybeSingle();

  if (permissionError) {
    throw new Error(
      `No se pudo verificar el permiso de la herramienta: ${permissionError.message}`
    );
  }

  if (!permission) {
    throw new Error(
      `La herramienta "${toolName}" no está habilitada para este empleado.`
    );
  }

  console.log(
    `[ACTION] Herramienta "${toolName}" autorizada.`
  );

  // 4. Separar el tipo de herramienta de sus argumentos
  const { type: _type, ...input } = action;

  // 5. Ejecutar la herramienta desde el Tool Registry
  const result = await tool.execute(input, {
    employeeId,
    taskId,
  });

  console.log(
    `[ACTION] Herramienta "${toolName}" ejecutada correctamente.`
  );

  return result;
}