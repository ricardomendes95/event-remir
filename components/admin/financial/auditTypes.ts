export type MatchStatus =
  | "MATCHED"
  | "AMOUNT_MISMATCH"
  | "UNMATCHED"
  | "DUPLICATE"
  | "DUPLICATE_PAYMENT"
  | "ACCOUNT_MOVEMENT"
  | "RESOLVED_MANUAL"
  | "IGNORED";

export const MATCH_LABELS: Record<MatchStatus, string> = {
  MATCHED: "Conferido",
  AMOUNT_MISMATCH: "Valor divergente",
  UNMATCHED: "Recebido sem inscrição correspondente",
  DUPLICATE_PAYMENT: "Recebido em duplicidade",
  ACCOUNT_MOVEMENT: "Movimentação da conta",
  RESOLVED_MANUAL: "Vinculado manualmente",
  IGNORED: "Marcado como externo",
  DUPLICATE: "Já importado antes",
};

export const MATCH_COLORS: Record<MatchStatus, string> = {
  MATCHED: "green",
  AMOUNT_MISMATCH: "orange",
  UNMATCHED: "red",
  DUPLICATE_PAYMENT: "volcano",
  ACCOUNT_MOVEMENT: "default",
  RESOLVED_MANUAL: "blue",
  IGNORED: "default",
  DUPLICATE: "default",
};

export interface AuditImportItem {
  id: string;
  fileName: string;
  importedByName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalRows: number;
  createdAt: string;
}

export interface AuditSuggestion {
  candidateId: string;
  score: number;
  label: string;
  eventTitle: string;
  amountCents: number;
}

export interface AuditEntry {
  id: string;
  kind: "PIX_RECEIVED" | "PIX_SENT" | "SALES_DEPOSIT" | "OTHER";
  payerName: string | null;
  description: string | null;
  amountCents: number;
  paidAt: string;
  matchStatus: MatchStatus;
  matchNote: string | null;
  registrationId: string | null;
  orderId: string | null;
  suggestions: AuditSuggestion[] | null;
}

export interface AuditCandidate {
  id: string;
  label: string;
  eventTitle: string;
  amountCents: number;
  paidAt: string | null;
  probableCard: boolean;
  checkable: boolean;
  registrationId: string | null;
  orderId: string | null;
}

export interface AuditDetail {
  import: AuditImportItem;
  counts: Partial<Record<MatchStatus, number>>;
  entries: AuditEntry[];
  uncovered: AuditCandidate[];
  linkOptions: AuditCandidate[];
}
