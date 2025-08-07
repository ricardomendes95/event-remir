import { NextRequest, NextResponse } from "next/server";
import { adminRepository } from "../../../../backend/repositories";
import { generateToken } from "../../../../backend/utils/jwt";
import { comparePassword } from "../../../../backend/utils/password";
import { LoginSchema } from "../../../../backend/schemas/authSchemas";

export async function POST(request: NextRequest) {
  try {
    // Validar dados de entrada
    const body = await request.json();

    // Validação com Zod
    const result = LoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Dados de entrada inválidos",
          errors: result.error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Buscar admin pelo email
    const admin = await adminRepository.findByEmail(email);

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenciais inválidas",
        },
        { status: 401 }
      );
    }

    // Verificar se o admin está ativo
    if (!admin.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Conta desativada. Entre em contato com o administrador.",
        },
        { status: 401 }
      );
    }

    // Verificar senha
    const isPasswordValid = await comparePassword(password, admin.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenciais inválidas",
        },
        { status: 401 }
      );
    }

    // Gerar token JWT
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    // Atualizar último login
    await adminRepository.updateLastLogin(admin.id);

    // Retornar dados do usuário (sem senha) e token
    const adminData = await adminRepository.getSafeById(admin.id);

    // Criar resposta com cookie
    const response = NextResponse.json({
      success: true,
      data: {
        user: adminData,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
      message: "Login realizado com sucesso",
    });

    // Definir cookie seguro com o token
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 horas em segundos
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erro no login:", error);

    // Tratar erros de validação do Zod
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          details: error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
