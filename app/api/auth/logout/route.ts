import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Cria uma resposta de sucesso
    const response = NextResponse.json(
      {
        message: "Logout realizado com sucesso",
        success: true,
      },
      { status: 200 }
    );

    // Remove o cookie de autenticação
    response.cookies.set("token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0), // Define expiração no passado para remover o cookie
    });

    return response;
  } catch (error) {
    console.error("Erro no logout:", error);

    return NextResponse.json(
      {
        message: "Erro interno do servidor",
        success: false,
      },
      { status: 500 }
    );
  }
}
