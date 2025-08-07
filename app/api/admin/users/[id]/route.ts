import { NextRequest } from "next/server";
import { userController } from "../../../../../backend/controllers/UserController";

// GET /api/admin/users/[id] - Buscar usuário por ID
export async function GET(request: NextRequest) {
  return userController.getUserById(request);
}

// PUT /api/admin/users/[id] - Atualizar usuário
export async function PUT(request: NextRequest) {
  return userController.updateUser(request);
}

// DELETE /api/admin/users/[id] - Deletar usuário
export async function DELETE(request: NextRequest) {
  return userController.deleteUser(request);
}
