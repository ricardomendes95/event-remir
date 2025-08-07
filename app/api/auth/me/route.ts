import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../backend/middlewares/authMiddleware";
import { adminRepository } from "../../../../backend/repositories";

export const GET = requireAdmin(async (req) => {
  try {
    if (!req.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário não encontrado no token",
        },
        { status: 401 }
      );
    }

    // Buscar dados completos do usuário no banco
    const adminData = await adminRepository.getSafeById(req.user.id);

    if (!adminData) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuário não encontrado",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: adminData,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar dados do usuário:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
});
