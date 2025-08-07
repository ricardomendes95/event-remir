import { NextRequest } from "next/server";
import { userController } from "../../../../../../backend/controllers/UserController";

// PUT /api/admin/users/[id]/toggle-status - Toggle status do usuário
export async function PUT(request: NextRequest) {
  return userController.toggleUserStatus(request);
}
