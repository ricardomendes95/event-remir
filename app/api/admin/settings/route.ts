import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getActivePaymentGateway,
  setActivePaymentGateway,
} from "@/backend/services/payment/getActiveGateway";

// Auth e role (ADMIN/SUPER_ADMIN) já são garantidos pelo middleware global,
// que protege todas as rotas /api/admin/*.

export async function GET() {
  try {
    const activePaymentGateway = await getActivePaymentGateway();
    return NextResponse.json({
      success: true,
      data: { activePaymentGateway },
    });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

const updateSettingsSchema = z.object({
  activePaymentGateway: z.enum(["MERCADO_PAGO", "INFINITE_PAY"]),
});

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { activePaymentGateway } = updateSettingsSchema.parse(body);

    const saved = await setActivePaymentGateway(activePaymentGateway);

    return NextResponse.json({
      success: true,
      data: { activePaymentGateway: saved },
      message: "Configurações atualizadas com sucesso",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 422 }
      );
    }
    console.error("Erro ao atualizar configurações:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
