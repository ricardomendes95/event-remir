import { NextRequest } from "next/server";
import { EventController } from "../../../backend/controllers/EventController";

const eventController = new EventController();

// GET /api/events - Listar eventos
export async function GET(request: NextRequest) {
  return await eventController.getEvents(request);
}

// POST /api/events - Criar novo evento
export async function POST(request: NextRequest) {
  return await eventController.createEvent(request);
}
