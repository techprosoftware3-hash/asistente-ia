import { createClient } from "@/lib/supabase/server";

export async function checkUserSubscription(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at, subscription_status, subscription_end_date")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { isActive: false };

  const now = new Date();
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : now;
  const subEndDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;

  const isTrialActive = now < trialEndsAt;
  const isSubActive = profile.subscription_status === "active" && subEndDate && now < subEndDate;

  return {
    isActive: isTrialActive || isSubActive,
  };
}