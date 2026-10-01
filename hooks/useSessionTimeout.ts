"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook para manejar el timeout de sesión por inactividad
 * @param timeoutMinutes - Tiempo en minutos antes de cerrar sesión (default: 120 minutos = 2 horas)
 * @param warningMinutes - Tiempo en minutos antes del timeout para mostrar aviso (default: 5 minutos)
 */
export function useSessionTimeout(timeoutMinutes: number = 120, warningMinutes: number = 5) {
  const router = useRouter();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Función para cerrar sesión
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Función para reiniciar el timer
  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    
    // Limpiar timers existentes
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    
    // Ocultar aviso si estaba visible
    setShowWarning(false);
    
    // Configurar nuevo warning
    const warningTime = (timeoutMinutes - warningMinutes) * 60 * 1000;
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeRemaining(warningMinutes * 60);
    }, warningTime);
    
    // Configurar nuevo timeout
    const timeoutTime = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeoutTime);
  };

  // Efecto para configurar los timers
  useEffect(() => {
    resetTimer();

    // Eventos que reinician el timer (actividad del usuario)
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Solo reiniciar si ha pasado al menos 1 segundo desde la última actividad
      // para evitar reiniciar el timer demasiado frecuentemente
      if (timeSinceLastActivity > 1000) {
        resetTimer();
      }
    };

    // Agregar listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [timeoutMinutes, warningMinutes]);

  // Efecto para el countdown del aviso
  useEffect(() => {
    if (showWarning && timeRemaining > 0) {
      const countdown = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [showWarning, timeRemaining]);

  // Función para extender la sesión (cuando el usuario ve el aviso)
  const extendSession = () => {
    resetTimer();
  };

  return {
    showWarning,
    timeRemaining,
    extendSession,
    logout,
  };
}
