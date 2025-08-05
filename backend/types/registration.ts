export interface Registration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  cpf?: string;
  paymentStatus: "pending" | "approved" | "rejected";
  paymentType: "pix" | "credit_card" | "manual";
  amountPaid: number;
  transactionId?: string;
  checkin: boolean;
  checkinAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegistrationWithEvent extends Registration {
  event: {
    id: string;
    title: string;
    date: Date;
    location: string;
  };
}

export interface CreateRegistrationData {
  eventId: string;
  name: string;
  email: string;
  cpf?: string;
}

export interface FinancialSummary {
  totalRegistrations: number;
  totalRevenue: number;
  paidRegistrations: number;
  pendingRegistrations: number;
  rejectedRegistrations: number;
  checkinCount: number;
  revenueByPaymentType: {
    pix: number;
    credit_card: number;
    manual: number;
  };
}

export interface RegistrationFilters {
  eventId?: string;
  paymentStatus?: "pending" | "approved" | "rejected";
  checkin?: boolean;
  search?: string;
}
