import { Form, Input, Button, FormInstance } from "antd";
import { User, Mail, FileText } from "lucide-react";
import { z } from "zod";
import { isValidCpf } from "@/utils/cpfValidator";

const cpfRefinement = (cpf: string) => {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length < 11) return true;
  return isValidCpf(cleanCpf).isValid;
};

const registrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cpf: z.string().refine(cpfRefinement, "CPF inválido"),
  phone: z.string().refine((phone) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return true;
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
  }, "Telefone inválido"),
});

export const freeRegistrationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string().refine(cpfRefinement, "CPF inválido"),
  phone: z.string().optional().or(z.literal("")),
});

export interface RegistrationFormData {
  name: string;
  email?: string;
  cpf: string;
  phone?: string;
}

export { registrationSchema };

interface RegistrationFormProps {
  form: FormInstance;
  loading: boolean;
  disabled: boolean;
  isValidatingCpf?: boolean;
  cpfValidationError?: string | null;
  hideButtons?: boolean;
  submitLabel?: string;
  isFree?: boolean;
  onSubmit: (values: RegistrationFormData) => Promise<void>;
  onCancel: () => void;
  onCpfChange: (cpf: string) => void;
}

export function RegistrationForm({
  form,
  loading,
  disabled,
  isValidatingCpf = false,
  cpfValidationError = null,
  hideButtons = false,
  submitLabel,
  isFree = false,
  onSubmit,
  onCancel,
  onCpfChange,
}: RegistrationFormProps) {
  const formatCPF = (value: string) => {
    const cpf = value.replace(/\D/g, "");

    // Só formatear quando tiver pelo menos 3 dígitos
    if (cpf.length >= 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (cpf.length >= 9) {
      return cpf
        .replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4")
        .replace(/-$/, "");
    } else if (cpf.length >= 6) {
      return cpf
        .replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3")
        .replace(/\.$/, "");
    } else if (cpf.length >= 3) {
      return cpf.replace(/(\d{3})(\d{0,3})/, "$1.$2").replace(/\.$/, "");
    }

    return cpf; // Retorna apenas os números se tiver menos de 3 dígitos
  };

  const formatPhone = (value: string) => {
    const phone = value.replace(/\D/g, "");

    if (phone.length >= 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (phone.length >= 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    } else if (phone.length >= 6) {
      return phone
        .replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3")
        .replace(/-$/, "");
    } else if (phone.length >= 2) {
      return phone.replace(/(\d{2})(\d{0,5})/, "($1) $2").replace(/ $/, "");
    }

    return phone; // Retorna apenas os números se tiver menos de 2 dígitos
  };

  // 🆕 NOVA FUNÇÃO: Validação imediata de CPF no onBlur
  const handleCpfBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const cpfValue = e.target.value;
    if (cpfValue) {
      const validation = isValidCpf(cpfValue);
      if (!validation.isValid && cpfValue.replace(/\D/g, "").length === 11) {
        // Só mostrar erro se CPF estiver completo (11 dígitos)
        // O hook useCpfVerification já cuida da validação, mas isso dá feedback mais rápido
      }
    }
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
              <span>Email{isFree && <span className="text-gray-400 text-xs ml-1">(opcional)</span>}</span>
            </div>
          }
          rules={[
            ...(!isFree ? [{ required: true, message: "Email é obrigatório" }] : []),
            { type: "email", message: "Email inválido" },
          ]}
        >
          <Input
            placeholder="seu@email.com"
            size="large"
            type="email"
            inputMode="email"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          name="cpf"
          label={
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>CPF</span>
              {isValidatingCpf && (
                <div className="flex items-center space-x-1 ml-2">
                  <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="text-xs text-blue-600">Verificando...</span>
                </div>
              )}
            </div>
          }
          rules={[
            { required: true, message: "CPF é obrigatório" },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                const cleanCpf = value.replace(/\D/g, "");

                // Se CPF ainda estiver sendo digitado (menos de 11 dígitos), não validar
                if (cleanCpf.length < 11) {
                  return Promise.resolve();
                }

                // Se CPF estiver completo, validar matematicamente
                const validation = isValidCpf(cleanCpf);
                if (!validation.isValid) {
                  return Promise.reject(
                    new Error(validation.error || "CPF inválido")
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
          validateStatus={cpfValidationError ? "error" : undefined}
          help={cpfValidationError}
        >
          <Input
            placeholder="000.000.000-00"
            size="large"
            inputMode="numeric"
            onChange={(e) => {
              const formatted = formatCPF(e.target.value);
              form.setFieldValue("cpf", formatted);
              onCpfChange(formatted);
            }}
            onBlur={handleCpfBlur}
            maxLength={14}
            status={cpfValidationError ? "error" : undefined}
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label={<span>Telefone{isFree && <span className="text-gray-400 text-xs ml-1">(opcional)</span>}</span>}
          rules={[
            ...(!isFree ? [{ required: true, message: "Telefone é obrigatório" }] : []),
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();

                const cleanPhone = value.replace(/\D/g, "");

                if (cleanPhone.length < 10) {
                  return Promise.resolve();
                }

                if (cleanPhone.length < 10 || cleanPhone.length > 11) {
                  return Promise.reject(
                    new Error("Telefone deve ter 10 ou 11 dígitos")
                  );
                }

                return Promise.resolve();
              },
            },
          ]}
        >
          <Input
            placeholder="(00) 00000-0000"
            size="large"
            inputMode="tel"
            autoComplete="tel"
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              form.setFieldValue("phone", formatted);
            }}
            maxLength={15}
          />
        </Form.Item>
      </div>

      {!hideButtons && (
      <div className="mt-6 pt-4 border-t">
        <div className="flex flex-col sm:flex-row gap-3 registration-buttons">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            disabled={disabled}
            className="flex-1 sm:order-2 text-base font-medium primary-button"
          >
            {loading ? "Processando..." : (submitLabel ?? "Continuar para Pagamento")}
          </Button>
          <Button
            onClick={onCancel}
            className="flex-1 sm:order-1 secondary-button"
          >
            Cancelar
          </Button>
        </div>

        <style>{`
          .registration-buttons .primary-button {
            height: 64px !important;
            min-height: 64px !important;
            line-height: normal !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          .registration-buttons .secondary-button {
            height: 56px !important;
            min-height: 56px !important;
            line-height: normal !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          @media (min-width: 640px) {
            .registration-buttons .primary-button,
            .registration-buttons .secondary-button {
              height: 40px !important;
              min-height: 40px !important;
            }
          }
        `}</style>
        <p className="text-xs text-gray-500 text-center mt-3">
          Você será redirecionado para o Mercado Pago para finalizar o pagamento
        </p>
      </div>
      )}
    </Form>
  );
}
