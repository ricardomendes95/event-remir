import { Modal, Form, Input, Button, message, Descriptions, Tag } from "antd";
import { FileText, Search, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";

interface ProofModalProps {
  open: boolean;
  onClose: () => void;
  preloadedData?: RegistrationProof | null;
}

interface RegistrationProof {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "PAYMENT_FAILED";
  paymentId: string;
  registrationDate: string;
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

  // Atualizar registration quando preloadedData mudar
  useEffect(() => {
    if (preloadedData) {
      setRegistration(preloadedData);
      setSearched(true);
    }
  }, [preloadedData]);

  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

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

  const handleClose = () => {
    form.resetFields();
    setRegistration(null);
    setSearched(false);
    onClose();
  };

  const handlePrint = () => {
    if (!registration) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const statusConfig = getStatusConfig(registration.status);

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
              <div class="info-row"><span class="label">Valor:</span> <span class="value">R$ ${registration.event.price.toFixed(
                2
              )}</span></div>
            </div>

            <div class="section">
              <div class="section-title">Dados do Participante</div>
              <div class="info-row"><span class="label">Nome:</span> <span class="value">${
                registration.name
              }</span></div>
              <div class="info-row"><span class="label">E-mail:</span> <span class="value">${
                registration.email
              }</span></div>
              <div class="info-row"><span class="label">CPF:</span> <span class="value">${formatCPF(
                registration.cpf
              )}</span></div>
              <div class="info-row"><span class="label">Telefone:</span> <span class="value">${
                registration.phone
              }</span></div>
            </div>

            <div class="section">
              <div class="section-title">Dados da Inscrição</div>
              <div class="info-row"><span class="label">ID da Inscrição:</span> <span class="value">${
                registration.id
              }</span></div>
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
                  Esta inscrição ainda está com o pagamento pendente. Clique no
                  botão <b>&quot;Continuar Pagamento&quot;</b> para finalizar
                  sua inscrição.
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
              <Descriptions.Item label="Valor">
                R$ {registration.event.price.toFixed(2)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions
              title="Dados do Participante"
              bordered
              size="small"
              column={1}
              className="mb-4"
            >
              <Descriptions.Item label="Nome">
                {registration.name}
              </Descriptions.Item>
              <Descriptions.Item label="E-mail">
                {registration.email}
              </Descriptions.Item>
              <Descriptions.Item label="CPF">
                {formatCPF(registration.cpf)}
              </Descriptions.Item>
              <Descriptions.Item label="Telefone">
                {registration.phone}
              </Descriptions.Item>
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
              <Descriptions.Item label="ID da Inscrição">
                {registration.id}
              </Descriptions.Item>

              <Descriptions.Item label="ID do Pagamento">
                {registration.paymentId}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </div>
    </Modal>
  );
}
