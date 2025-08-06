"use client";

import { useState } from "react";
import { Spin, Result, Button } from "antd";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

interface PaymentStatus {
  status: "processing" | "success" | "error" | "pending";
  message: string;
  details?: string;
}

interface MercadoPagoCheckoutProps {
  preferenceId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onPending?: () => void;
}

export function MercadoPagoCheckout({
  preferenceId,
  onSuccess,
  onError,
  onPending,
}: MercadoPagoCheckoutProps) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: "processing",
    message: "Preparando checkout...",
  });

  const handleCheckoutRedirect = () => {
    // Em modo de teste, usar sandbox
    const isProduction = process.env.NODE_ENV === "production";
    const baseUrl = isProduction
      ? "https://www.mercadopago.com.br/checkout/v1/redirect"
      : "https://sandbox.mercadopago.com.br/checkout/v1/redirect";

    const checkoutUrl = `${baseUrl}?pref_id=${preferenceId}`;

    // Redirecionar para o checkout
    window.location.href = checkoutUrl;
  };

  const renderProcessing = () => (
    <div className="text-center py-8">
      <div className="mb-6">
        <CreditCard className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Redirecionando para o pagamento
        </h3>
        <p className="text-gray-600">
          Você será redirecionado para o Mercado Pago em instantes...
        </p>
      </div>

      <div className="space-y-4">
        <Spin size="large" />
        <div>
          <Button
            type="primary"
            size="large"
            onClick={handleCheckoutRedirect}
            className="min-w-[200px]"
          >
            Ir para Pagamento
          </Button>
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <p>Processamento 100% seguro via Mercado Pago</p>
        <p>Seus dados estão protegidos</p>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <Result
      icon={<CheckCircle className="h-16 w-16 text-green-600 mx-auto" />}
      status="success"
      title="Pagamento Aprovado!"
      subTitle={paymentStatus.message}
      extra={[
        <Button type="primary" key="dashboard" onClick={onSuccess}>
          Ver Comprovante
        </Button>,
      ]}
    />
  );

  const renderError = () => (
    <Result
      icon={<XCircle className="h-16 w-16 text-red-600 mx-auto" />}
      status="error"
      title="Erro no Pagamento"
      subTitle={paymentStatus.message}
      extra={[
        <Button type="primary" key="retry" onClick={handleCheckoutRedirect}>
          Tentar Novamente
        </Button>,
      ]}
    />
  );

  const renderPending = () => (
    <Result
      icon={<Clock className="h-16 w-16 text-yellow-600 mx-auto" />}
      status="warning"
      title="Pagamento Pendente"
      subTitle={paymentStatus.message}
      extra={[
        <Button type="primary" key="status" onClick={onPending}>
          Verificar Status
        </Button>,
      ]}
    />
  );

  switch (paymentStatus.status) {
    case "success":
      return renderSuccess();
    case "error":
      return renderError();
    case "pending":
      return renderPending();
    default:
      return renderProcessing();
  }
}

// Hook para gerenciar status do pagamento
export function usePaymentStatus() {
  const [status, setStatus] = useState<PaymentStatus>({
    status: "processing",
    message: "Verificando status...",
  });

  const checkPaymentStatus = async (paymentId: string) => {
    try {
      const response = await fetch(
        `/api/payments/status?paymentId=${paymentId}`
      );
      const data = await response.json();

      if (data.success) {
        switch (data.status) {
          case "approved":
            setStatus({
              status: "success",
              message: "Seu pagamento foi aprovado com sucesso!",
            });
            break;
          case "rejected":
            setStatus({
              status: "error",
              message: "Pagamento rejeitado. Tente novamente.",
            });
            break;
          case "pending":
            setStatus({
              status: "pending",
              message: "Pagamento em análise. Aguarde a confirmação.",
            });
            break;
          default:
            setStatus({
              status: "processing",
              message: "Verificando status do pagamento...",
            });
        }
      } else {
        setStatus({
          status: "error",
          message: "Erro ao verificar status do pagamento",
        });
      }
    } catch (error) {
      setStatus({
        status: "error",
        message: "Erro de conexão ao verificar pagamento",
      });
    }
  };

  return {
    status,
    checkPaymentStatus,
    setStatus,
  };
}
