import { NextResponse } from "next/server";
import { requireAuthenticated } from "../../../../backend/middlewares/authMiddleware";
import { adminRepository } from "../../../../backend/repositories";

// Qualquer perfil autenticado (inclusive CHECKIN/SUPPORT) pode ver o próprio perfil
export const GET = requireAuthenticated(async (req) => {
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
