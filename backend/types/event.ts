export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  price: number;
  bannerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventWithStats extends Event {
  totalRegistrations: number;
  totalRevenue: number;
  confirmedRegistrations: number;
  checkinCount: number;
}

export interface CreateEventData {
  title: string;
  description: string;
  location: string;
  date: string;
  price: number;
  bannerUrl?: string;
}

export type UpdateEventData = Partial<CreateEventData>;
