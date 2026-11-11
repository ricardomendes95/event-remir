import { Modal, Form, Input, Button, message, Descriptions, Tag } from "antd";
import { FileText, Search, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";
import QRCode from "qrcode";
import Image from "next/image";

interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  preloadedData?: RegistrationProof | null;
}

interface RegistrationProof {
  id: string;
  name: string;
  email: string | null;
  cpf: string;
  phone: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId: string;
  registrationDate: string;
  /** Valor efetivamente pago pela inscrição (com camisa, se escolhida). */
  amountPaid?: number;
  wantsShirt?: boolean;
  shirtSize?: string | null;
  /** Indica se o evento oferece camisa (para exibir a linha no comprovante). */
  eventHasShirt?: boolean;
  /** Pedido de cancelamento mais recente do próprio participante. */
  refundRequest?: {
    status: "OPEN" | "IN_CONTACT" | "RESOLVED";
    resolution:
      | "REFUNDED"
      | "DENIED"
      | "WITHDRAWN"
      | "CANCELLED_NO_REFUND"
      | null;
    createdAt: string;
  } | null;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
}

const cpfSchema = z
  .string()
  .min(11, "CPF deve ter 11 dígitos")
  .max(14, "CPF inválido");

export function RegistrationProofModal({
  open,
  onClose,
  preloadedData = null,
}: ProofModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [registration, setRegistration] = useState<RegistrationProof | null>(
    preloadedData
  );
  const [searched, setSearched] = useState(!!preloadedData);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSending, setCancelSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Atualizar registration quando preloadedData mudar
  useEffect(() => {
    if (!preloadedData) return;
    setRegistration(preloadedData);
    setSearched(true);

    // Se o preloadedData veio sem o valor pago / dados da camisa (ex.: aberto a
    // partir de uma inscrição existente), completar via get-by-id.
    if (preloadedData.amountPaid === undefined && preloadedData.id) {
      fetch("/api/registrations/get-by-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: preloadedData.id }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((full) => {
          if (full && full.id) {
            setRegistration(
              (prev) => ({ ...(prev as RegistrationProof), ...full })
            );
          }
        })
        .catch(() => {});
    }
  }, [preloadedData]);

  // Gerar QR code quando registration mudar
  useEffect(() => {
    const generateQRCode = async () => {
      if (registration?.id) {
        try {
          const qrCodeDataUrl = await QRCode.toDataURL(registration.id, {
            width: 200,
            margin: 2,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
          setQrCodeUrl(qrCodeDataUrl);
        } catch (error) {
          console.error("Erro ao gerar QR code:", error);
        }
      }
    };

    generateQRCode();
  }, [registration]);

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Valor efetivamente pago (com camisa, se escolhida). Cai para o preço do
  // evento caso a inscrição seja antiga e não tenha o valor calculado.
  const getAmountPaid = (r: RegistrationProof) =>
    typeof r.amountPaid === "number" ? r.amountPaid : r.event.price;

  // Texto da camisa para o comprovante.
  const getShirtText = (r: RegistrationProof) =>
    r.wantsShirt ? `Sim — Tamanho ${r.shirtSize ?? "—"}` : "Não";

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return {
          color: "green",
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Confirmado",
        };
      case "PENDING":
        return {
          color: "orange",
          icon: <Clock className="w-4 h-4" />,
          text: "Pendente",
        };
      case "CANCELLED":
        return {
          color: "red",
          icon: <XCircle className="w-4 h-4" />,
          text: "Cancelado",
        };
      case "PAYMENT_FAILED":
        return {
          color: "red",
          icon: <XCircle className="w-4 h-4" />,
          text: "Falha no Pagamento",
        };
      default:
        return { color: "default", icon: null, text: status };
    }
  };

  const handleSearch = async (values: { cpf: string }) => {
    try {
      setLoading(true);
      setSearched(true);

      // Validar CPF
      const cleanCpf = values.cpf.replace(/\D/g, "");
      cpfSchema.parse(cleanCpf);

      // Buscar inscrição por CPF
      const response = await fetch(`/api/registrations/search-by-cpf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cleanCpf }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setRegistration(null);
          message.warning("Nenhuma inscrição encontrada para este CPF");
          return;
        }
        throw new Error("Erro ao buscar inscrição");
      }

      const data = await response.json();
      setRegistration(data);
      message.success("Inscrição encontrada!");
    } catch (error) {
      console.error("Erro na busca:", error);

      if (error instanceof z.ZodError) {
        message.error("CPF inválido");
      } else {
        message.error("Erro ao buscar inscrição. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const setRefundRequest = (refundRequest: RegistrationProof["refundRequest"]) =>
    setRegistration((prev) => (prev ? { ...prev, refundRequest } : prev));

  const handleRequestCancel = async () => {
    if (!registration) return;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      message.warning("Conte em poucas palavras o motivo do cancelamento");
      return;
    }
    try {
      setCancelSending(true);
      const response = await fetch(
        `/api/registrations/${registration.id}/refund-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: registration.cpf, reason }),
        }
      );
      const result = await response.json().catch(() => null);
      const sent = {
        status: "OPEN" as const,
        resolution: null,
        createdAt: new Date().toISOString(),
      };
      if (response.ok) {
        message.success(
          "Recebemos sua solicitação. Entraremos em contato pelo WhatsApp."
        );
      } else if (response.status === 409) {
        message.info(result?.error ?? "Já recebemos sua solicitação.");
      } else {
        message.error(
          result?.error ?? "Não foi possível enviar. Tente novamente."
        );
        return;
      }
      setRefundRequest(sent);
      setCancelOpen(false);
      setCancelReason("");
    } catch {
      message.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setCancelSending(false);
    }
  };

  const handleWithdrawCancel = async () => {
    if (!registration) return;
    try {
      setWithdrawing(true);
      const response = await fetch(
        `/api/registrations/${registration.id}/refund-request`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: registration.cpf }),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        message.error(result?.error ?? "Não foi possível desistir agora.");
        return;
      }
      message.success("Pedido encerrado. Sua inscrição segue ativa.");
      setRefundRequest({
        status: "RESOLVED",
        resolution: "WITHDRAWN",
        createdAt: new Date().toISOString(),
      });
    } catch {
      message.error("Não foi possível desistir agora. Tente novamente.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setRegistration(null);
    setSearched(false);
    setQrCodeUrl("");
    setCancelOpen(false);
    setCancelReason("");
    onClose();
  };

  const handlePrint = async () => {
    if (!registration) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusConfig = getStatusConfig(registration.status);

    // Gerar QR code para impressão se não existir
    let qrCodeDataUrl = qrCodeUrl;
    if (!qrCodeDataUrl && registration.id) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(registration.id, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
      } catch (error) {
        console.error("Erro ao gerar QR code para impressão:", error);
      }
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprovante de Inscrição</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #1f2937; }
            .subtitle { font-size: 16px; color: #6b7280; margin-top: 5px; }
            .content { max-width: 600px; margin: 0 auto; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 18px; font-weight: bold; color: #374151; margin-bottom: 10px; }
            .info-row { margin-bottom: 8px; }
            .label { font-weight: bold; color: #4b5563; }
            .value { color: #1f2937; }
            .status { 
              display: inline-block; 
              padding: 4px 12px; 
              border-radius: 4px; 
              font-weight: bold;
              background-color: ${
                statusConfig.color === "green"
                  ? "#10b981"
                  : statusConfig.color === "orange"
                  ? "#f59e0b"
                  : "#ef4444"
              };
              color: white;
            }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Comprovante de Inscrição</div>
            <div class="subtitle">Event Remir</div>
          </div>
          
          <div class="content">
            <div class="section">
              <div class="section-title">Dados do Evento</div>
              <div class="info-row"><span class="label">Evento:</span> <span class="value">${
                registration.event.title
              }</span></div>
              <div class="info-row"><span class="label">Data:</span> <span class="value">${new Date(
                registration.event.date
              ).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</span></div>
              <div class="info-row"><span class="label">Local:</span> <span class="value">${
                registration.event.location
              }</span></div>
              <div class="info-row"><span class="label">Valor pago:</span> <span class="value">R$ ${getAmountPaid(
                registration
              ).toFixed(2)}</span></div>
              ${
                registration.eventHasShirt
                  ? `<div class="info-row"><span class="label">Camisa:</span> <span class="value">${getShirtText(
                      registration
                    )}</span></div>`
                  : ""
              }
            </div>

            <div class="section">
              <div class="section-title">Dados do Participante</div>
              <div class="info-row"><span class="label">Nome:</span> <span class="value">${registration.name}</span></div>
              ${registration.email ? `<div class="info-row"><span class="label">E-mail:</span> <span class="value">${registration.email}</span></div>` : ""}
              <div class="info-row"><span class="label">CPF:</span> <span class="value">${formatCPF(registration.cpf)}</span></div>
              ${registration.phone ? `<div class="info-row"><span class="label">Telefone:</span> <span class="value">${registration.phone}</span></div>` : ""}
            </div>

            <div class="section">
              <div class="section-title">Dados da Inscrição</div>
              <div class="info-row">
                <span class="label">ID da Inscrição:</span> 
                <span class="value">${registration.id}</span>
              </div>
              ${
                qrCodeDataUrl
                  ? `
              <div class="info-row" style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block;">
                  <img src="${qrCodeDataUrl}" alt="QR Code do ID da Inscrição" style="border: 1px solid #ddd; border-radius: 4px;" />
                  <div style="font-size: 10px; color: #666; margin-top: 5px;">QR Code para Check-in</div>
                </div>
              </div>
              `
                  : ""
              }
              <div class="info-row"><span class="label">Status:</span> <span class="status">${
                statusConfig.text
              }</span></div>
              <div class="info-row"><span class="label">Data da Inscrição:</span> <span class="value">${new Date(
                registration.registrationDate
              ).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</span></div>
              <div class="info-row"><span class="label">ID do Pagamento:</span> <span class="value">${
                registration.paymentId
              }</span></div>
            </div>
          </div>

          <div class="footer">
            <p>Comprovante gerado em ${new Date().toLocaleDateString(
              "pt-BR"
            )} às ${new Date().toLocaleTimeString("pt-BR")}</p>
            <p>Event Remir - Sistema de Gestão de Eventos</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-green-600" />
          <span>Comprovante de Inscrição</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={700}
      destroyOnHidden
    >
      <div className="py-4">
        {/* Formulário de Busca */}
        <div className="mb-6">
          <Form
            form={form}
            onFinish={handleSearch}
            layout="vertical"
            noValidate
          >
            <Form.Item
              label="CPF do participante"
              name="cpf"
              rules={[
                { required: true, message: "CPF é obrigatório" },
                { min: 11, message: "CPF deve ter 11 dígitos" },
              ]}
            >
              <Input
                prefix={<Search className="h-4 w-4 text-gray-400" />}
                placeholder="000.000.000-00"
                maxLength={14}
                inputMode="numeric"
                onChange={(e) => {
                  const formatted = formatCPF(e.target.value);
                  form.setFieldValue("cpf", formatted);
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<Search className="h-4 w-4" />}
                block
              >
                Buscar Inscrição
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* Resultado da Busca */}
        {searched && !registration && (
          <div className="text-center py-8">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Nenhuma inscrição encontrada para este CPF
            </p>
          </div>
        )}

        {/* Comprovante */}
        {registration && (
          <div className="border rounded-lg p-6 bg-gray-50 flex flex-col gap-4">
            {registration.status !== "CONFIRMED" && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-orange-800">
                  {registration.status === "CANCELLED" ? (
                    <>
                      Esta inscrição foi cancelada. Para participar, toque em{" "}
                      <b>&quot;Continuar Pagamento&quot;</b> e faça a inscrição
                      novamente.
                    </>
                  ) : (
                    <>
                      Esta inscrição ainda está com o pagamento pendente.
                      Clique no botão <b>&quot;Continuar Pagamento&quot;</b>{" "}
                      para finalizar sua inscrição.
                    </>
                  )}
                </p>
              </div>
            )}
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Comprovante de Inscrição
              </h3>
              <div className="flex gap-2">
                <Button
                  type="primary"
                  ghost
                  onClick={handlePrint}
                  icon={<FileText className="h-4 w-4" />}
                >
                  Imprimir
                </Button>
                {registration.status !== "CONFIRMED" && (
                  <Button
                    type="primary"
                    onClick={() =>
                      (window.location.href = `/?cpf=${registration.cpf}`)
                    }
                  >
                    Continuar Pagamento
                  </Button>
                )}
              </div>
            </div>

            {registration.status === "CONFIRMED" &&
              (() => {
                const req = registration.refundRequest;
                const active =
                  req?.status === "OPEN" || req?.status === "IN_CONTACT";
                if (active) {
                  return (
                    <div
                      className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-3"
                      data-testid="refund-active"
                    >
                      <p className="text-blue-900">
                        <b>Pedido de cancelamento em análise.</b> A organização
                        vai entrar em contato com você. Sua inscrição continua
                        valendo até lá.
                      </p>
                      <Button
                        block
                        loading={withdrawing}
                        onClick={handleWithdrawCancel}
                        style={{ minHeight: 44 }}
                      >
                        Desistir do cancelamento
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-3">
                    {req?.status === "RESOLVED" &&
                      req.resolution === "DENIED" && (
                        <p className="text-sm text-gray-700 p-3 bg-gray-100 rounded-lg">
                          Seu último pedido de cancelamento não foi aprovado.
                          Sua inscrição segue ativa. Em caso de dúvida, fale com
                          a organização do evento.
                        </p>
                      )}
                    <Button
                      danger
                      block
                      onClick={() => setCancelOpen(true)}
                      style={{ minHeight: 44 }}
                    >
                      Solicitar cancelamento
                    </Button>
                  </div>
                );
              })()}

            <Descriptions
              title="Dados do Evento"
              bordered
              size="small"
              column={1}
              className="mb-4"
            >
              <Descriptions.Item label="Evento">
                {registration.event.title}
              </Descriptions.Item>
              <Descriptions.Item label="Data">
                {new Date(registration.event.date).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Descriptions.Item>
              <Descriptions.Item label="Local">
                {registration.event.location}
              </Descriptions.Item>
              <Descriptions.Item label="Valor pago">
                R$ {getAmountPaid(registration).toFixed(2)}
              </Descriptions.Item>
              {registration.eventHasShirt && (
                <Descriptions.Item label="Camisa">
                  {getShirtText(registration)}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions
              title="Dados do Participante"
              bordered
              size="small"
              column={1}
              className="mb-4"
            >
              <Descriptions.Item label="Nome">{registration.name}</Descriptions.Item>
              {registration.email && (
                <Descriptions.Item label="E-mail">{registration.email}</Descriptions.Item>
              )}
              <Descriptions.Item label="CPF">{formatCPF(registration.cpf)}</Descriptions.Item>
              {registration.phone && (
                <Descriptions.Item label="Telefone">{registration.phone}</Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions
              title="Dados da Inscrição"
              bordered
              size="small"
              column={1}
            >
              <Descriptions.Item label="Status">
                <Tag
                  color={getStatusConfig(registration.status).color}
                  icon={getStatusConfig(registration.status).icon}
                  className="flex gap-1 items-center"
                >
                  {getStatusConfig(registration.status).text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Data da Inscrição">
                {new Date(registration.registrationDate).toLocaleDateString(
                  "pt-BR",
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </Descriptions.Item>
              <Descriptions.Item label="ID do Pagamento">
                {registration.paymentId}
              </Descriptions.Item>
              <Descriptions.Item label="QR Code da Inscrição">
                <div className="flex items-center gap-4">
                  {qrCodeUrl && (
                    <div className="flex flex-col items-center">
                      <Image
                        src={qrCodeUrl}
                        alt="QR Code do ID da Inscrição"
                        width={200}
                        height={200}
                        className="border border-gray-200 rounded"
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        QR Code para Check-in
                      </span>
                    </div>
                  )}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </div>

      <Modal
        title="Solicitar cancelamento"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={handleRequestCancel}
        okText="Enviar solicitação"
        cancelText="Voltar"
        okButtonProps={{ loading: cancelSending, danger: true }}
        destroyOnHidden
      >
        <p className="text-gray-700 mb-3">
          Conte o motivo e a organização entrará em contato pelo WhatsApp. Seu
          pedido será analisado: ele não cancela a inscrição na hora, e a
          devolução do valor, quando houver, é combinada com a organização e
          depende do meio de pagamento usado.
        </p>
        <Input.TextArea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Qual o motivo do cancelamento?"
          rows={4}
          maxLength={500}
          showCount
        />
      </Modal>
    </Modal>
  );
}
