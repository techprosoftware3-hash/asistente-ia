"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function SubscriptionBanner() {
  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-50">
      <div className="flex items-center gap-2 text-center sm:text-left">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">
          <strong>Periodo de prueba finalizado:</strong> Tu cuenta se encuentra en modo de solo lectura. Las acciones de creación y chat están deshabilitadas hasta renovar la suscripción.
        </p>
      </div>
      <Link
        href="/dashboard/upgrade"
        className="bg-slate-950 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-slate-800 transition shadow shrink-0"
      >
        Realizar Pago / Renovar
      </Link>
    </div>
  );
}