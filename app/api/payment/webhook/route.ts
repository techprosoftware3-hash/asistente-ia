import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con Service Role para actualizar la base de datos sin restricciones de usuario
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Capturamos tanto el formato clásico (IPN) como el formato moderno de Webhooks de Mercado Pago
    const paymentId = body.data?.id || (body.type === 'payment' && body.id);

    if (body.type === 'payment' || body.topic === 'payment' || paymentId) {
      const idToFetch = paymentId || body.data?.id;
      
      if (!idToFetch) {
        return NextResponse.json({ received: true });
      }

      // Consultar los detalles reales del pago directamente a la API de Mercado Pago
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${idToFetch}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const paymentData = await mpRes.json();

      // Validar si el pago se completó y aprobó con éxito
      if (paymentData.status === 'approved') {
        const userId = paymentData.external_reference; // ID de usuario enviado previamente

        if (userId) {
          // Calcular nueva fecha de vencimiento (30 días a partir de la confirmación)
          const newEndDate = new Date();
          newEndDate.setDate(newEndDate.getDate() + 30);

          // Actualizar el perfil del usuario en Supabase de forma segura
          await supabaseAdmin
            .from('profiles')
            .update({
              subscription_status: 'active',
              subscription_end_date: newEndDate.toISOString()
            })
            .eq('id', userId);
        }
      }
    }

    // Respuesta inmediata con código 200 requerida por la plataforma de pagos
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error procesando el webhook de pago:", error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}