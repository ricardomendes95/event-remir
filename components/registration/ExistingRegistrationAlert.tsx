import { Button } from "antd";
import { Search, Receipt, CreditCard, Users } from "lucide-react";
import type { ExistingOrderContext } from "@/hooks/useCpfVerification";

interface ExistingRegistration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId: string | null;
  registrationDate: string;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
  order?: ExistingOrderContext | null;
}

interface ExistingRegistrationAlertProps {
  registration: ExistingRegistration;
  onCheckReceipt: () => void;
  onContinuePayment: () => void;
  /** Continuar o pagamento do grupo todo (inscrição pendente em pedido em grupo). */
  onContinueOrder?: () => void;
  /** Sair do grupo para se inscrever sozinho (Opção C do RFC). */
  onLeaveOrder?: () => void;
  groupLoading?: boolean;
}

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function ExistingRegistrationAlert({
  registration,
  onCheckReceipt,
  onContinuePayment,
  onContinueOrder,
  onLeaveOrder,
  groupLoading = false,
}: ExistingRegistrationAlertProps) {
  const order = registration.order ?? null;
  const pendingInGroup =
    !!order && order.status === "PENDING" && registration.status === "PENDING";

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Search className="h-5 w-5 text-yellow-600 mt-0.5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-800 mb-2">
            CPF já cadastrado
          </h3>
          <p className="text-sm text-yellow-700 mb-3">
            Encontramos uma inscrição existente para este CPF:
          </p>

          <div className="bg-white rounded p-3 mb-4 text-sm">
            <p>
              <strong>Nome:</strong> {registration.name}
            </p>
            <p>
              <strong>Email:</strong> {registration.email}
            </p>
            <p>
              <strong>Status:</strong>
              <span
                className={`ml-1 px-2 py-1 rounded text-xs ${
                  registration.status === "CONFIRMED"
                    ? "bg-green-100 text-green-800"
                    : registration.status === "PENDING"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {registration.status === "CONFIRMED"
                  ? "Confirmado"
                  : registration.status === "PENDING"
                  ? "Pendente"
                  : "Cancelado"}
              </span>
            </p>
            <p>
              <strong>Data:</strong>{" "}
              {new Date(registration.registrationDate).toLocaleString("pt-BR")}
            </p>
          </div>

          {order && (
            <div
              className="bg-white border border-yellow-300 rounded p-3 mb-4 text-sm"
              data-testid="group-alert"
            >
              <p className="flex items-center gap-2 font-medium text-yellow-900">
                <Users className="h-4 w-4" />
                Esta inscrição faz parte de uma compra em grupo
              </p>
              <p className="text-yellow-800 mt-1">
                {order.participantsCount} pessoas
                {order.otherParticipants.length > 0 &&
                  ` (você e ${order.otherParticipants.join(", ")})`}
                {pendingInGroup && ` · Total do grupo ${formatBRL(order.totalValue)}`}
              </p>
            </div>
          )}

          {pendingInGroup ? (
            <div className="flex flex-col gap-2">
              <Button
                type="primary"
                icon={<CreditCard className="h-4 w-4" />}
                onClick={onContinueOrder}
                loading={groupLoading}
                className="w-full"
                style={{ minHeight: "48px", height: "auto", whiteSpace: "normal" }}
              >
                Continuar pagamento do grupo ({formatBRL(order!.totalValue)})
              </Button>
              {order!.canLeave && (
                <Button
                  onClick={onLeaveOrder}
                  disabled={groupLoading}
                  className="w-full"
                  style={{ minHeight: "48px", height: "auto", whiteSpace: "normal" }}
                >
                  Sair do grupo e me inscrever sozinho
                </Button>
              )}
              <p className="text-xs text-yellow-700">
                Se você sair, o valor do grupo é recalculado para quem fica e
                você segue com o pagamento só da sua inscrição.
              </p>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            {registration.status === "CONFIRMED" && (
              <Button
                type="primary"
                icon={<Receipt className="h-4 w-4" />}
                onClick={onCheckReceipt}
                className="w-full"
              >
                Ver Comprovante
              </Button>
            )}
            {registration.status === "PENDING" && registration.paymentId && (
              <Button
                type="primary"
                icon={<CreditCard className="h-4 w-4" />}
                onClick={onContinuePayment}
                className="w-full"
              >
                Continuar Pagamento
              </Button>
            )}

            {(registration.status === "CANCELLED" ||
              registration.status === "PAYMENT_FAILED") && (
              <Button
                type="primary"
                icon={<CreditCard className="h-4 w-4" />}
                onClick={onContinuePayment}
                className="w-full"
              >
                Refazer Pagamento
              </Button>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
