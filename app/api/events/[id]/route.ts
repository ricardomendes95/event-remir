import { NextRequest } from "next/server";
import { EventController } from "../../../../backend/controllers/EventController";

const eventController = new EventController();

// GET /api/events/[id] - Buscar evento por ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return await eventController.getEventById(request, { params });
}

// PUT /api/events/[id] - Atualizar evento
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return await eventController.updateEvent(request, { params });
}

// DELETE /api/events/[id] - Deletar evento
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  return await eventController.deleteEvent(request, { params });
}
