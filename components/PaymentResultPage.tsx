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

interface OrderData {
  id: string;
  status: string;
  totalValue: number;
  participants: { id: string; name: string; status: string }[];
}

export default function PaymentResultPage({ type }: PaymentResultPageProps) {
  const [loading, setLoading] = useState(true);
  const [registration, setRegistration] = useState<RegistrationData | null>(
    null
  );
  const [order, setOrder] = useState<OrderData | null>(null);
  const [isShirtOrder, setIsShirtOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Mercado Pago retorna payment_id/preference_id; InfinitePay retorna
    // order_nsu (= id da inscrição). Aceitamos também registration_id.
    const paymentId = searchParams.get("payment_id");
    const preferenceId = searchParams.get("preference_id");
    const registrationId =
      searchParams.get("registration_id") || searchParams.get("order_nsu");

    let query: string;
    if (registrationId) {
      query = `registrationId=${encodeURIComponent(registrationId)}`;
    } else if (paymentId || preferenceId) {
      query = `paymentId=${encodeURIComponent(
        (paymentId || preferenceId) as string
      )}`;
    } else {
      setError("Informações de pagamento não encontradas");
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_RETRIES = 5; // ~15s no total

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/payments/status?${query}`);
        const data = await response.json();
        if (cancelled) return;

        if (data.success) {
          setRegistration(data.registration);
          setOrder(data.order ?? null);
          setIsShirtOrder(!!data.shirtOrder);
          setError(null);

          // Na tela de sucesso, a confirmação vem do webhook e pode demorar
          // alguns segundos. Enquanto estiver PENDING, tentamos de novo
          // automaticamente para atualizar a tela sem ação do usuário.
          if (
            type === "success" &&
            data.registration?.status === "PENDING" &&
            attempts < MAX_RETRIES
          ) {
            attempts++;
            timer = setTimeout(checkPaymentStatus, 3000);
          }
        } else {
          setError(data.error || "Erro ao verificar status do pagamento");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Payment verification error:", err);
        setError("Erro de conexão ao verificar pagamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkPaymentStatus();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchParams, type]);

  const handleGoHome = () => {
    router.push("/");
  };

  const handleViewComprovante = () => {
    const registrationId =
      searchParams.get("registration_id") || searchParams.get("order_nsu");
    const paymentId = searchParams.get("payment_id");
    const slug = searchParams.get("slug");

    const params = new URLSearchParams();
    if (registrationId) params.set("registration_id", registrationId);
    if (paymentId) params.set("payment_id", paymentId);
    params.set("comprovante", "true");

    const base = slug ? `/eventos/${slug}` : "/";
    router.push(`${base}?${params.toString()}`);
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
    // Usar o status real da API em vez da prop type
    const actualStatus = registration?.status;

    // Se temos dados da API, usar o status real
    if (actualStatus === "CONFIRMED") {
      return {
        icon: <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />,
        status: "success" as const,
        title: "Pagamento Aprovado!",
        subTitle: isShirtOrder
          ? "Pagamento da camisa confirmado. Ela já consta no seu comprovante."
          : order
          ? `As ${order.participants.length} inscrições foram confirmadas com sucesso.`
          : "Sua inscrição foi confirmada com sucesso.",
        extra: [
          <Button
            key="comprovante"
            type="primary"
            onClick={handleViewComprovante}
          >
            <FileText className="h-4 w-4 mr-2" />
            {order ? "Ver Comprovantes" : "Ver Comprovante"}
          </Button>,
          <Button key="home" onClick={handleGoHome}>
            <Home className="h-4 w-4 mr-2" />
            Voltar ao Início
          </Button>,
        ],
      };
    } else if (actualStatus === "PAYMENT_FAILED") {
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
    } else if (actualStatus === "CANCELLED") {
      return {
        icon: <XCircle className="h-16 w-16 text-gray-600 mx-auto" />,
        status: "warning" as const,
        title: "Pagamento Cancelado",
        subTitle: "O pagamento foi cancelado.",
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
    } else if (actualStatus === "PENDING") {
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
    }

    // Fallback para quando não temos dados ainda - usar prop type como backup
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
      default:
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

        {order && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg" data-testid="order-details">
            <h4 className="font-medium text-gray-900 mb-2">
              Compra em grupo ({order.participants.length} pessoas)
            </h4>
            <ul className="mb-2">
              {order.participants.map((p) => (
                <li key={p.id} className="text-sm">
                  {p.name}
                  <span className="text-gray-500">
                    {" "}
                    ·{" "}
                    {p.status === "CONFIRMED"
                      ? "Confirmada"
                      : p.status === "PENDING"
                        ? "Pendente"
                        : "Cancelada"}
                  </span>
                </li>
              ))}
            </ul>
            <Paragraph className="mb-0">
              <strong>Total:</strong> R$ {order.totalValue.toFixed(2).replace(".", ",")}
            </Paragraph>
          </div>
        )}

        {registration && !order && (
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
                : registration.status === "PAYMENT_FAILED"
                ? "Falha no Pagamento"
                : "Cancelado"}
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
}
