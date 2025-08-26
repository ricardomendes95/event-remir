import { Button } from "antd";
import { Search, Receipt, CreditCard } from "lucide-react";

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
}

interface ExistingRegistrationAlertProps {
  registration: ExistingRegistration;
  onCheckReceipt: () => void;
  onContinuePayment: () => void;
}

export function ExistingRegistrationAlert({
  registration,
  onCheckReceipt,
  onContinuePayment,
}: ExistingRegistrationAlertProps) {
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
        </div>
      </div>
    </div>
  );
}
