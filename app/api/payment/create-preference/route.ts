import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });

export async function POST(req: Request) {
  try {
    const { userEmail, userId, planType } = await req.json();

    const isYearly = planType === 'yearly';
    const unitPrice = isYearly ? 100000 : 1000;
    const title = isYearly ? 'Suscripción Anual - AI Employees' : 'Suscripción Mensual - AI Employees';

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swoop-spiral-preseason.ngrok-free.dev';
    const backUrl = `${baseUrl}/dashboard?payment=success`;

    const preApproval = new PreApproval(client);
    
    const result = await preApproval.create({
      body: {
        reason: title,
        auto_recurring: {
          frequency: isYearly ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: unitPrice,
          currency_id: 'ARS',
        },
        back_url: backUrl,
        payer_email: userEmail,
        external_reference: userId,
        status: 'pending',
      },
    });

    // Devolvemos el init_point para redirigir al usuario fuera de la app
    return NextResponse.json({ init_point: result.init_point });
  } catch (error: any) {
    console.error("Error creando suscripción recurrente:", error);
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 });
  }
}
