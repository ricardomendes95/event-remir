import { Form, Input, Button, FormInstance } from "antd";
import { User, Mail, FileText } from "lucide-react";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z
    .string()
    .regex(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      "CPF deve estar no formato 000.000.000-00"
    ),
  phone: z
    .string()
    .regex(
      /^\(\d{2}\) \d{4,5}-\d{4}$/,
      "Telefone deve estar no formato (00) 00000-0000"
    ),
});

export type RegistrationFormData = z.infer<typeof registrationSchema>;
export { registrationSchema };

interface RegistrationFormProps {
  form: FormInstance;
  loading: boolean;
  disabled: boolean;
  onSubmit: (values: RegistrationFormData) => Promise<void>;
  onCancel: () => void;
  onCpfChange: (cpf: string) => void;
}

export function RegistrationForm({
  form,
  loading,
  disabled,
  onSubmit,
  onCancel,
  onCpfChange,
}: RegistrationFormProps) {
  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");
    if (cpf.length <= 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value; // Retorna o valor original se exceder 11 dígitos
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value; // Retorna o valor original se exceder 11 dígitos
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      requiredMark={false}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Form.Item
          name="name"
          label={
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Nome Completo</span>
            </div>
          }
          rules={[
            { required: true, message: "Nome é obrigatório" },
            { min: 2, message: "Nome deve ter pelo menos 2 caracteres" },
          ]}
        >
          <Input placeholder="Digite seu nome completo" size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          label={
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </div>
          }
          rules={[
            { required: true, message: "Email é obrigatório" },
            { type: "email", message: "Email inválido" },
          ]}
        >
          <Input placeholder="seu@email.com" size="large" />
        </Form.Item>

        <Form.Item
          name="cpf"
          label={
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>CPF</span>
            </div>
          }
          rules={[{ required: true, message: "CPF é obrigatório" }]}
        >
          <Input
            placeholder="000.000.000-00"
            size="large"
            onChange={(e) => {
              const formatted = formatCPF(e.target.value);
              form.setFieldValue("cpf", formatted);
              onCpfChange(formatted);
            }}
            maxLength={14}
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Telefone"
          rules={[{ required: true, message: "Telefone é obrigatório" }]}
        >
          <Input
            placeholder="(00) 00000-0000"
            size="large"
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              form.setFieldValue("phone", formatted);
            }}
            maxLength={15}
          />
        </Form.Item>
      </div>

      <div className="mt-6 pt-4 border-t">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onCancel} size="large" className="flex-1">
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            disabled={disabled}
            className="flex-1"
          >
            {loading ? "Processando..." : "Continuar para Pagamento"}
          </Button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          Você será redirecionado para o Mercado Pago para finalizar o pagamento
        </p>
      </div>
    </Form>
  );
}
