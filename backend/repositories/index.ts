// Base Repository
export { BaseRepository } from "./BaseRepository";

// Event Repository
export {
  EventRepository,
  type Event,
  type EventWithStats,
} from "./EventRepository";

// Registration Repository
export {
  RegistrationRepository,
  type Registration,
  type RegistrationWithEvent,
} from "./RegistrationRepository";

// Admin Repository
export { AdminRepository, type Admin, type SafeAdmin } from "./AdminRepository";

// Repository instances (singleton pattern)
import { EventRepository } from "./EventRepository";
import { RegistrationRepository } from "./RegistrationRepository";
import { AdminRepository } from "./AdminRepository";

export const eventRepository = new EventRepository();
export const registrationRepository = new RegistrationRepository();
export const adminRepository = new AdminRepository();
