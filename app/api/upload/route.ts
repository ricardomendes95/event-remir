import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "../../../lib/cloudinary";
import { verifyToken } from "../../../backend/utils/jwt";

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação manual
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Token de autenticação necessário",
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    try {
      const decoded = verifyToken(token);

      // Verificar se é admin
      if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
        return NextResponse.json(
          {
            success: false,
            error: "Acesso negado - privilégios de administrador necessários",
          },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Token inválido",
        },
        { status: 401 }
      );
    }

    // Verificar se o request tem arquivo
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhum arquivo foi enviado",
        },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Tipo de arquivo não permitido. Use: JPEG, PNG ou WebP",
        },
        { status: 400 }
      );
    }

    // Validar tamanho (5MB máximo)
    const maxSize = 5 * 1024 * 1024; // 5MB em bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "Arquivo muito grande. Tamanho máximo: 5MB",
        },
        { status: 400 }
      );
    }

    // Upload para Cloudinary
    const imageUrl = await uploadImage(file);

    return NextResponse.json({
      success: true,
      data: {
        url: imageUrl,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
      message: "Imagem enviada com sucesso",
    });
  } catch (error) {
    console.error("Erro no upload:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor no upload da imagem",
      },
      { status: 500 }
    );
  }
}

// Configuração para aumentar limite de upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb", // Limite de 10MB para o body
    },
  },
};
