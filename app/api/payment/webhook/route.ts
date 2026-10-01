import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

// Cliente de Supabase con Service Role para actualizar la base de datos sin restricciones de usuario
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type MercadoPagoPreApproval = {
  status?: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { frequency?: number; frequency_type?: string };
};

type MercadoPagoAuthorizedPayment = {
  preapproval_id?: string;
  status?: string;
  payment?: { status?: string };
};

async function fetchMercadoPago<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`Mercado Pago respondió ${res.status} para ${path}`);
    return null;
  }
  return res.json() as Promise<T>;
}

async function activateSubscription(userId: string, endDate: Date, planType: string = 'personal') {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_end_date: endDate.toISOString(),
      subscription_plan: planType,
    })
    .eq('id', userId);

  if (error) throw error;
}

function subscriptionEndDate(preApproval: MercadoPagoPreApproval) {
  const next = preApproval.next_payment_date ? new Date(preApproval.next_payment_date) : null;
  if (next && next.getTime() > Date.now()) return next;

  const months = preApproval.auto_recurring?.frequency_type === 'months'
    ? preApproval.auto_recurring.frequency || 1
    : 1;
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  return end;
}

// Activa el plan si la suscripción está autorizada. Devuelve true si se activó.
async function activateFromPreApproval(preApprovalId: string, expectedUserId?: string) {
  const preApproval = await fetchMercadoPago<MercadoPagoPreApproval>(
    `/preapproval/${encodeURIComponent(preApprovalId)}`
  );
  if (!preApproval || preApproval.status !== 'authorized') return false;

  const externalReference = preApproval.external_reference;
  if (!externalReference) return false;

  // Parsear userId y planType del external_reference (formato: userId:planType)
  const [userId, planType] = externalReference.split(':');
  if (!userId || (expectedUserId && userId !== expectedUserId)) return false;

  await activateSubscription(userId, subscriptionEndDate(preApproval), planType || 'personal');
  return true;
}

// Busca una suscripción autorizada del usuario cuando no tenemos el preapproval_id
async function activateFromUserSearch(userId: string, email?: string) {
  const searches = [
    new URLSearchParams({ status: 'authorized', limit: '100', ...(email ? { payer_email: email } : {}) }),
    new URLSearchParams({ status: 'authorized', limit: '100' }),
  ];

  for (const params of searches) {
    const result = await fetchMercadoPago<{ results?: MercadoPagoPreApproval[] }>(
      `/preapproval/search?${params}`
    );
    const match = result?.results?.find(
      (p) => p.external_reference.startsWith(userId) && p.status === 'authorized'
    );
    if (match) {
      const externalReference = match.external_reference;
      const [parsedUserId, planType] = externalReference.split(':');
      if (parsedUserId === userId) {
        await activateSubscription(userId, subscriptionEndDate(match), planType || 'personal');
        return true;
      }
    }
  }
  return false;
}

// Mercado Pago notifica aquí los eventos de suscripciones y pagos
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const type: string | undefined = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic') || undefined;
    const id: string | undefined = body.data?.id?.toString() || url.searchParams.get('data.id') || url.searchParams.get('id') || undefined;

    if (!type || !id) {
      return NextResponse.json({ received: true });
    }

    if (type === 'subscription_preapproval' || type === 'preapproval') {
      await activateFromPreApproval(id);
    } else if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
      const authorizedPayment = await fetchMercadoPago<MercadoPagoAuthorizedPayment>(
        `/authorized_payments/${encodeURIComponent(id)}`
      );
      if (authorizedPayment?.preapproval_id && authorizedPayment.payment?.status === 'approved') {
        await activateFromPreApproval(authorizedPayment.preapproval_id);
      }
    } else if (type === 'payment') {
      const paymentData = await fetchMercadoPago<{ status?: string; external_reference?: string }>(
        `/v1/payments/${encodeURIComponent(id)}`
      );

      if (paymentData?.status === 'approved' && paymentData.external_reference) {
        const externalReference = paymentData.external_reference;
        const [userId, planType] = externalReference.split(':');
        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + 30);
        await activateSubscription(userId, newEndDate, planType || 'personal');
      }
    }

    // Respuesta inmediata con código 200 requerida por la plataforma de pagos
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error procesando el webhook de pago:", error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

// Verifica y activa la suscripción del usuario logueado (opcionalmente con ?preapproval_id=...)
export async function GET(req: Request) {
  try {
    const preApprovalId = new URL(req.url).searchParams.get('preapproval_id');

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const active = preApprovalId
      ? await activateFromPreApproval(preApprovalId, user.id)
      : await activateFromUserSearch(user.id, user.email);
    return NextResponse.json({ active });
  } catch (error) {
    console.error("Error verificando la suscripción:", error);
    return NextResponse.json({ error: 'Error verificando la suscripción' }, { status: 500 });
  }
}
