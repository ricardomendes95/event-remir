import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyEntryAction } from "@/backend/services/audit/auditService";
import { auditErrorResponse, denyIfNotAdmin } from "@/backend/services/audit/routeHelpers";

const EntryActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("link"),
    registrationId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
  }),
  z.object({ action: z.literal("ignore") }),
  z.object({ action: z.literal("unlink") }),
]);

// PATCH /api/admin/audit/entries/[id] - Vincular manualmente, marcar como externo ou desfazer
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const denied = denyIfNotAdmin(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = EntryActionSchema.parse(await request.json().catch(() => null));
    const entry = await applyEntryAction(id, body, {
      name: request.headers.get("x-user-name"),
    });
    return NextResponse.json({
      success: true,
      data: { id: entry.id, matchStatus: entry.matchStatus, matchNote: entry.matchNote },
    });
  } catch (error) {
    return auditErrorResponse(error);
  }
}
