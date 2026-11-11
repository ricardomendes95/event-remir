"use client";

import { useState } from "react";
import { Modal, Tag, message } from "antd";
import { CheckCircle, Clock, Receipt, XCircle } from "lucide-react";
import { RegistrationProofModal } from "../RegistrationProofModal";

export interface GroupProofData {
  eventTitle: string;
  /** Status do pedido (compra paga) ou "CONFIRMED" para lote gratuito. */
  status: string;
  /** Total pago; omitido em lote gratuito. */
  totalValue?: number | null;
  participants: { id: string; name: string; status: string }[];
}

interface GroupProofModalProps {
  open: boolean;
  onClose: () => void;
  data: GroupProofData | null;
}

type ProofData = Parameters<typeof RegistrationProofModal>[0]["preloadedData"];

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  CONFIRMED: { color: "green", text: "Confirmado" },
  PENDING: { color: "orange", text: "Pendente" },
  CANCELLED: { color: "red", text: "Cancelado" },
  PAYMENT_FAILED: { color: "red", text: "Falha no pagamento" },
};

function statusIcon(status: string) {
  if (status === "CONFIRMED") return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (status === "PENDING") return <Clock className="h-5 w-5 text-yellow-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

const formatBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace(".", ",")}`;

/**
 * Comprovante consolidado de uma compra em grupo: lista as pessoas e abre o
 * comprovante individual (com QR code de check-in) de cada uma.
 */
export function GroupProofModal({ open, onClose, data }: GroupProofModalProps) {
  const [proof, setProof] = useState<ProofData>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openProof = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch("/api/registrations/get-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: id }),
      });
      if (!res.ok) throw new Error();
      const r = await res.json();
      setProof({
        id: r.id,
        name: r.name,
        email: r.email ?? "",
        cpf: r.cpf,
        phone: r.phone ?? "",
        status: r.status,
        paymentId: r.paymentId ?? "",
        registrationDate: r.registrationDate,
        amountPaid: r.amountPaid,
        wantsShirt: r.wantsShirt,
        shirtSize: r.shirtSize,
        eventHasShirt: r.eventHasShirt,
        event: {
          title: r.event.title,
          price: r.event.price,
          date: r.event.date,
          location: r.event.location ?? "",
        },
      });
      setProofOpen(true);
    } catch {
      message.error("Não foi possível abrir o comprovante. Tente novamente.");
    } finally {
      setLoadingId(null);
    }
  };

  const tag = data ? (STATUS_TAG[data.status] ?? STATUS_TAG.PENDING) : null;

  return (
    <>
      <Modal
        title="Comprovante da compra em grupo"
        open={open}
        onCancel={onClose}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {data && tag && (
          <div data-testid="group-proof">
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{data.eventTitle}</p>
              <p className="text-sm text-gray-600 mt-1">
                {data.participants.length} inscrições nesta compra
                {typeof data.totalValue === "number" &&
                  ` · Total ${formatBRL(data.totalValue)}`}
              </p>
              <div className="mt-2">
                <Tag color={tag.color}>{tag.text}</Tag>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Cada pessoa tem o próprio comprovante, com o QR code para o
              check-in. Toque no nome para abrir.
            </p>

            <ul className="space-y-2">
              {data.participants.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openProof(p.id)}
                    disabled={loadingId === p.id}
                    style={{ minHeight: "56px" }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {statusIcon(p.status)}
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className="flex items-center gap-1 text-sm text-blue-700 flex-shrink-0">
                      <Receipt className="h-4 w-4" />
                      {loadingId === p.id ? "Abrindo..." : "Ver comprovante"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      <RegistrationProofModal
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        preloadedData={proof}
      />
    </>
  );
}
