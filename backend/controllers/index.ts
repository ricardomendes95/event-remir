// Base Controller
export { BaseController, type ApiResponse } from "./BaseController";

// Event Controller
export { EventController } from "./EventController";

// Controller instances (singleton pattern)
import { EventController } from "./EventController";

export const eventController = new EventController();
