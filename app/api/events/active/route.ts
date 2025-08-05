import { NextRequest } from "next/server";
import { EventController } from "../../../../backend/controllers/EventController";

const eventController = new EventController();

// GET /api/events/active - Buscar evento ativo atual
export async function GET(request: NextRequest) {
  // Criar uma nova URL com parâmetro active=true
  const url = new URL(request.url);
  url.searchParams.set("active", "true");
  url.searchParams.set("limit", "1");

  // Criar novo request com os parâmetros
  const newRequest = new NextRequest(url);

  return await eventController.getEvents(newRequest);
}
