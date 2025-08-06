"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Result, Button, Card, Spin, Typography } from "antd";
import { CheckCircle, XCircle, Clock, Home, FileText } from "lucide-react";

const { Paragraph } = Typography;

interface PaymentResultPageProps {
  type: "success" | "failure" | "pending";
}

interface RegistrationData {
  id: string;
  name: string;
  email: string;
  event: string;
  status: string;
}

export default function PaymentResultPage({ type }: PaymentResultPageProps) {
  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<RegistrationData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const paymentId = searchParams.get("payment_id");
        const preferenceId = searchParams.get("preference_id");

        if (!paymentId && !preferenceId) {
          setError("Informações de pagamento não encontradas");
          return;
        }

        const response = await fetch(
          `/api/payments/status?paymentId=${paymentId || preferenceId}`
        );
        const data = await response.json();

        if (data.success) {
          setRegistration(data.registration);
        } else {
          setError(data.error || "Erro ao verificar status do pagamento");
        }
      } catch (err) {
        setError("Erro de conexão ao verificar pagamento");
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [searchParams]);

  const handleGoHome = () => {
    router.push("/");
  };

  const handleViewComprovante = () => {
    const registrationId = searchParams.get("registration_id");
    const paymentId = searchParams.get("payment_id");

    if (registrationId || paymentId) {
      const params = new URLSearchParams();
      if (registrationId) params.set("registration_id", registrationId);
      if (paymentId) params.set("payment_id", paymentId);
      params.set("comprovante", "true");

      router.push(`/?${params.toString()}`);
    } else {
      router.push("/?comprovante=true");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="text-center p-8">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">
            Verificando status do pagamento...
          </p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <Result
            icon={<XCircle className="h-16 w-16 text-red-600 mx-auto" />}
            status="error"
            title="Erro ao Verificar Pagamento"
            subTitle={error}
            extra={[
              <Button key="home" type="primary" onClick={handleGoHome}>
                Voltar ao Início
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  const getResultContent = () => {
    switch (type) {
      case "success":
        return {
          icon: <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />,
          status: "success" as const,
          title: "Pagamento Aprovado!",
          subTitle: "Sua inscrição foi confirmada com sucesso.",
          extra: [
            <Button
              key="comprovante"
              type="primary"
              onClick={handleViewComprovante}
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver Comprovante
            </Button>,
            <Button key="home" onClick={handleGoHome}>
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>,
          ],
        };

      case "failure":
        return {
          icon: <XCircle className="h-16 w-16 text-red-600 mx-auto" />,
          status: "error" as const,
          title: "Pagamento Rejeitado",
          subTitle: "Houve um problema com seu pagamento. Tente novamente.",
          extra: [
            <Button key="retry" type="primary" onClick={handleGoHome}>
              Tentar Novamente
            </Button>,
            <Button key="home" onClick={handleGoHome}>
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>,
          ],
        };

      case "pending":
        return {
          icon: <Clock className="h-16 w-16 text-yellow-600 mx-auto" />,
          status: "warning" as const,
          title: "Pagamento Pendente",
          subTitle:
            "Seu pagamento está em análise. Você receberá uma confirmação em breve.",
          extra: [
            <Button
              key="status"
              type="primary"
              onClick={() => window.location.reload()}
            >
              Verificar Status
            </Button>,
            <Button key="home" onClick={handleGoHome}>
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>,
          ],
        };

      default:
        return {
          icon: <XCircle className="h-16 w-16 text-gray-600 mx-auto" />,
          status: "info" as const,
          title: "Status Desconhecido",
          subTitle: "Não foi possível determinar o status do pagamento.",
          extra: [
            <Button key="home" type="primary" onClick={handleGoHome}>
              Voltar ao Início
            </Button>,
          ],
        };
    }
  };

  const resultContent = getResultContent();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <Result
          icon={resultContent.icon}
          status={resultContent.status}
          title={resultContent.title}
          subTitle={resultContent.subTitle}
          extra={resultContent.extra}
        />

        {registration && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">
              Detalhes da Inscrição
            </h4>
            <Paragraph className="mb-1">
              <strong>Nome:</strong> {registration.name}
            </Paragraph>
            <Paragraph className="mb-1">
              <strong>Email:</strong> {registration.email}
            </Paragraph>
            <Paragraph className="mb-1">
              <strong>Evento:</strong> {registration.event}
            </Paragraph>
            <Paragraph className="mb-0">
              <strong>Status:</strong>{" "}
              {registration.status === "CONFIRMED"
                ? "Confirmado"
                : registration.status === "PENDING"
                ? "Pendente"
                : "Cancelado"}
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
}
