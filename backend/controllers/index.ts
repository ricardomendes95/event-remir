// Base Controller
export { BaseController, type ApiResponse } from "./BaseController";

// Event Controller
export { EventController } from "./EventController";

// User Controller
export { UserController } from "./UserController";

// Controller instances (singleton pattern)
import { EventController } from "./EventController";
import { UserController } from "./UserController";

export const eventController = new EventController();
export const userController = new UserController();
