import { NextRequest } from "next/server";
import { userController } from "../../../../backend/controllers/UserController";

// GET /api/admin/users - Listar usuários
export async function GET(request: NextRequest) {
  return userController.getUsers(request);
}

// POST /api/admin/users - Criar usuário
export async function POST(request: NextRequest) {
  return userController.createUser(request);
}
