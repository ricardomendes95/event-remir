export interface Event {
  id: string;
  name: string;
  description?: string;
  eventDate: string;
  location?: string;
  capacity: number;
  currentRegistrations: number;
  price: number;
  bannerUrl?: string;
  isActive: boolean;
  registrationEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  name: string;
  description?: string;
  eventDate: string;
  location?: string;
  capacity: number;
  price: number;
  bannerUrl?: string;
}
