import { NextResponse } from "next/server";
import { runAutomationForAllUsers } from "@/lib/automation";

export async function GET(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const result =
      await runAutomationForAllUsers();

    return NextResponse.json({
      message:
        "Cron de automatización ejecutado.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Error en cron de automatización:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error desconocido.",
      },
      { status: 500 }
    );
  }
}