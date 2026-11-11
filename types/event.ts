export type EventFormMode = "FIXED_ONLY" | "DYNAMIC_ONLY" | "BOTH";

/** Lote vigente exposto ao público (sem quotas nem contagens). */
export interface ActiveBatch {
  name: string;
  price: number;
  priceWithShirt: number | null;
  endDate: string;
  limitedByQuota: boolean;
}

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
  isFree: boolean;
  formMode: EventFormMode;
  /** Permite inscrever várias pessoas em uma compra (create-batch-preference / create-free-batch). */
  allowBatchRegistration?: boolean;
  dynamicFormFields?: unknown;
  fixedFieldsConfig?: { email?: { required: boolean }; phone?: { required: boolean } };
  shirtConfig?: {
    enabled: boolean;
    priceWithShirt: number;
    sizes: string[];
    /** Prazo (ISO) para compra posterior da camisa; vazio = sem prazo. */
    purchaseDeadline?: string | null;
    /** Foto opcional da camisa (URL do Cloudinary). */
    imageUrl?: string;
  };
  registrationEndDate?: string;
  /** Lote vigente; `price` e `shirtConfig` já vêm com os valores do lote. */
  activeBatch?: ActiveBatch | null;
  /** Evento com lotes e nenhum vigente: inscrições fechadas. */
  batchesClosed?: boolean;
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
  isFree?: boolean;
  formMode?: EventFormMode;
  dynamicFormFields?: unknown;
}
