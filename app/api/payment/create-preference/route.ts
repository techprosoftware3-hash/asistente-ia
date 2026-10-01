import { NextResponse } from 'next/server';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

const getMercadoPagoClient = () => {
  if (!process.env.MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN is not configured");
  }
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
};

export async function POST(req: Request) {
  try {
    const client = getMercadoPagoClient();
    
    const { userEmail, userId, planType } = await req.json();

    const isEnterprise = planType === 'enterprise';
    const unitPrice = isEnterprise ? 60000 : 25000;
    const title = isEnterprise ? 'Plan Enterprise - miasistentelab.com' : 'Plan Personal - miasistentelab.com';

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const backUrl = `${baseUrl}/dashboard?payment=success`;

    const preApproval = new PreApproval(client);
    
    const result = await preApproval.create({
      body: {
        reason: title,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: unitPrice,
          currency_id: 'ARS',
        },
        back_url: backUrl,
        payer_email: userEmail,
        external_reference: `${userId}:${planType}`, // Guardamos userId y planType
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
