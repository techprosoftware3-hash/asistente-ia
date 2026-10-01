"use client";

import { useSessionTimeout } from "@/hooks/useSessionTimeout";

interface SessionTimeoutWarningProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export function SessionTimeoutWarning({ 
  timeoutMinutes = 120, 
  warningMinutes = 5 
}: SessionTimeoutWarningProps) {
  const { showWarning, timeRemaining, extendSession, logout } = useSessionTimeout(
    timeoutMinutes,
    warningMinutes
  );

  if (!showWarning) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h2 className="text-xl font-bold text-gray-900">
            Sesión por expirar
          </h2>
          <p className="text-gray-600 mt-2">
            Tu sesión expirará en{" "}
            <span className="font-bold text-red-600">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>{" "}
            por inactividad.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={extendSession}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Extender sesión
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
