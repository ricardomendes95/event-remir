import { NextRequest } from "next/server";
import { userController } from "../../../../../../backend/controllers/UserController";

// PUT /api/admin/users/[id]/change-password - Alterar senha
export async function PUT(request: NextRequest) {
  return userController.changePassword(request);
}
