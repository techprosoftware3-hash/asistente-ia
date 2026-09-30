import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { checkUserSubscription } from "@/lib/utils/subscription";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verificar si la suscripción o el periodo de prueba está activo
  const { isActive } = await checkUserSubscription(user.id);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Si la prueba venció, mostramos el banner de aviso en la parte superior */}
      {!isActive && <SubscriptionBanner />}
      
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}