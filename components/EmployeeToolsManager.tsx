"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tool = {
  name: string;
  description: string;
};

type Props = {
  employeeId: string;
  registryTools: Tool[];
  initialToolsMap: Record<string, boolean>;
};

export default function EmployeeToolsManager({
  employeeId,
  registryTools,
  initialToolsMap,
}: Props) {
  const supabase = createClient();
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(initialToolsMap);

  const toggleTool = async (toolName: string) => {
    const currentState = !!enabledTools[toolName];
    const newState = !currentState;

    // Actualización optimista de la interfaz
    setEnabledTools((prev) => ({ ...prev, [toolName]: newState }));

    // Guardar o actualizar el estado en Supabase
    const { error } = await supabase
      .from("employee_tools")
      .upsert(
        {
          employee_id: employeeId,
          tool_name: toolName,
          enabled: newState,
        },
        { onConflict: "employee_id,tool_name" }
      );

    if (error) {
      console.error("Error al actualizar la herramienta:", error.message);
      // Revertir el estado en caso de error
      setEnabledTools((prev) => ({ ...prev, [toolName]: currentState }));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {registryTools.map((tool) => {
        const isEnabled = !!enabledTools[tool.name];

        return (
          <div
            key={tool.name}
            className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
              isEnabled 
                ? "border-gray-900 bg-white shadow-sm ring-1 ring-gray-900/5" 
                : "border-gray-200 bg-gray-50/50 opacity-75 hover:opacity-100"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-gray-100 text-gray-800">
                  {tool.name}
                </span>

                {/* Switch moderno y bien alineado */}
                <button
                  type="button"
                  onClick={() => toggleTool(tool.name)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? "bg-black" : "bg-gray-300"
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {tool.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-medium">
              <span>Estado</span>
              <span className={isEnabled ? "text-green-600 font-semibold" : "text-gray-500"}>
                {isEnabled ? "● Habilitada" : "○ Deshabilitada"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}