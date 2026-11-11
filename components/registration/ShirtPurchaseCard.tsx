"use client";

import { useState } from "react";
import { Button, Modal, message } from "antd";
import { Shirt } from "lucide-react";
import { redirectToPayment } from "@/utils/paymentRedirect";

export interface ShirtPurchaseOffer {
  available: boolean;
  /** Valor da camisa em reais (diferença do lote da inscrição). */
  price: number;
  sizes: string[];
  deadline: string | null;
  pending: { orderId: string; shirtSize: string | null } | null;
}

interface ShirtPurchaseCardProps {
  registrationId: string;
  cpf: string;
  offer: ShirtPurchaseOffer;
}

const brl = (value: number) =>
  `R$ ${value.toFixed(2).replace(".", ",")}`;

/**
 * Compra posterior da camisa a partir do comprovante: escolhe o tamanho e vai
 * direto ao pagamento, sem novo cadastro. Com pedido de camisa pendente, o
 * mesmo botão continua o pagamento (o servidor reaproveita o pedido).
 */
export function ShirtPurchaseCard({
  registrationId,
  cpf,
  offer,
}: ShirtPurchaseCardProps) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const pendingSize = offer.pending?.shirtSize ?? null;
  const deadlineText = offer.deadline
    ? new Date(offer.deadline).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const goToPayment = async (shirtSize: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/payments/create-shirt-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, cpf, shirtSize }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data?.checkoutUrl) {
        message.error(
          body?.error ?? "Não foi possível iniciar o pagamento. Tente novamente."
        );
        return;
      }
      const result = redirectToPayment(body.data.checkoutUrl);
      if (result.fallbackNeeded) {
        setManualUrl(body.data.checkoutUrl);
        message.warning(
          "Se a página de pagamento não abrir, toque no botão para abrir manualmente."
        );
      }
    } catch {
      message.error("Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const handleStart = () => {
    if (pendingSize) {
      void goToPayment(pendingSize);
      return;
    }
    setSize(null);
    setOpen(true);
  };

  const handleConfirm = () => {
    if (!size) {
      message.warning("Escolha o tamanho da camisa");
      return;
    }
    void goToPayment(size);
  };

  return (
    <div
      className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-3"
      data-testid="shirt-purchase-card"
    >
      <div className="flex items-start gap-3">
        <Shirt className="h-6 w-6 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900">
            {pendingSize
              ? `Pagamento da camisa pendente (tamanho ${pendingSize})`
              : "Quer a camisa do evento?"}
          </p>
          <p className="text-sm text-blue-900">
            {brl(offer.price)}
            {deadlineText ? ` · compra até ${deadlineText}` : ""}
          </p>
        </div>
      </div>
      <Button
        type="primary"
        block
        loading={loading}
        onClick={handleStart}
        style={{ minHeight: 44 }}
      >
        {pendingSize ? "Continuar pagamento da camisa" : "Quero a camisa"}
      </Button>
      {manualUrl && (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center font-semibold text-blue-800 underline"
        >
          Abrir pagamento manualmente
        </a>
      )}

      <Modal
        title="Escolha o tamanho da camisa"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <p className="text-gray-700 mb-3">
          Valor: <b>{brl(offer.price)}</b>. Você paga só a camisa, sua inscrição
          continua a mesma.
        </p>
        <div
          className="grid grid-cols-3 gap-2 mb-4"
          role="radiogroup"
          aria-label="Tamanho da camisa"
        >
          {offer.sizes.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={size === s}
              onClick={() => setSize(s)}
              className={`rounded-lg border-2 font-semibold ${
                size === s
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-gray-300 bg-white text-gray-800"
              }`}
              style={{ minHeight: 48 }}
            >
              {s}
            </button>
          ))}
        </div>
        <Button
          type="primary"
          block
          loading={loading}
          disabled={!size}
          onClick={handleConfirm}
          style={{ minHeight: 44 }}
        >
          Ir para o pagamento
        </Button>
      </Modal>
    </div>
  );
}
