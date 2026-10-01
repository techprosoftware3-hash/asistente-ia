import { createClient } from "@/lib/supabase/server";

export type SubscriptionPlan = 'personal' | 'enterprise';

export interface SubscriptionInfo {
  isActive: boolean;
  plan: SubscriptionPlan;
  employeeLimit: number;
}

export async function checkUserSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at, subscription_status, subscription_end_date, subscription_plan")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { isActive: false, plan: 'personal', employeeLimit: 5 };

  const now = new Date();
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : now;
  const subEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;

  const isTrialActive = now < trialEndsAt;
  const isSubActive = profile.subscription_status === "active" && subEndDate && now < subEndDate;

  const plan: SubscriptionPlan = (profile.subscription_plan as SubscriptionPlan) || 'personal';
  const employeeLimit = plan === 'enterprise' ? Infinity : 5;

  return {
    isActive: isTrialActive || isSubActive,
    plan,
    employeeLimit,
  };
}