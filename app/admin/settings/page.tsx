"use client";

import { useEffect, useState } from "react";
import { Card, Typography, Button, Spin, Alert, message } from "antd";
import {
  CheckCircleFilled,
  CreditCardOutlined,
  SafetyOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

type Gateway = "INFINITE_PAY" | "MERCADO_PAGO";

interface GatewayOption {
  value: Gateway;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: GatewayOption[] = [
  {
    value: "INFINITE_PAY",
    title: "InfinitePay",
    badge: "Padrão",
    description:
      "Gateway usado em todas as novas inscrições pagas. Pix e cartão em até 12x.",
    icon: <CreditCardOutlined style={{ fontSize: 22 }} />,
  },
  {
    value: "MERCADO_PAGO",
    title: "Mercado Pago",
    badge: "Redundância",
    description:
      "Use como alternativa caso precise trocar de gateway. Pix, débito e crédito.",
    icon: <SafetyOutlined style={{ fontSize: 22 }} />,
  },
];

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Gateway>("INFINITE_PAY");
  const [savedValue, setSavedValue] = useState<Gateway>("INFINITE_PAY");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        if (json?.success && json.data?.activePaymentGateway) {
          setSelected(json.data.activePaymentGateway);
          setSavedValue(json.data.activePaymentGateway);
        }
      } catch {
        message.error("Não foi possível carregar as configurações.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePaymentGateway: selected }),
      });
      const json = await res.json();
      if (json?.success) {
        setSavedValue(selected);
        message.success("Gateway de pagamento atualizado!");
      } else {
        message.error(json?.error || "Erro ao salvar configurações.");
      }
    } catch {
      message.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = selected !== savedValue;

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "16px 12px 96px",
      }}
    >
      <Title level={3} style={{ marginBottom: 4 }}>
        Configurações
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Defina o gateway de pagamento usado em todo o site. Esta opção vale para
        todas as novas inscrições pagas.
      </Paragraph>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
        </div>
      ) : (
        <>
          <Text strong style={{ display: "block", marginBottom: 12 }}>
            Gateway de pagamento ativo
          </Text>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {OPTIONS.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Card
                  key={opt.value}
                  hoverable
                  onClick={() => setSelected(opt.value)}
                  styles={{ body: { padding: 16 } }}
                  style={{
                    borderWidth: 2,
                    borderColor: isSelected ? "#2563eb" : "#e5e7eb",
                    background: isSelected ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        color: isSelected ? "#2563eb" : "#6b7280",
                        marginTop: 2,
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Text strong style={{ fontSize: 16 }}>
                          {opt.title}
                        </Text>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#fff",
                            background: isSelected ? "#2563eb" : "#9ca3af",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          {opt.badge}
                        </span>
                        {savedValue === opt.value && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#15803d",
                            }}
                          >
                            • Ativo agora
                          </span>
                        )}
                      </div>
                      <Text
                        type="secondary"
                        style={{ fontSize: 13, display: "block", marginTop: 4 }}
                      >
                        {opt.description}
                      </Text>
                    </div>
                    {isSelected && (
                      <CheckCircleFilled
                        style={{ color: "#2563eb", fontSize: 20 }}
                      />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="Inscrições já criadas não mudam de gateway."
            description="A troca afeta apenas novas inscrições. O comprovante das inscrições existentes continua registrando onde o pagamento foi feito."
          />

          <Button
            type="primary"
            size="large"
            block
            loading={saving}
            disabled={!hasChanges}
            onClick={handleSave}
            style={{ marginTop: 20, height: 48, fontWeight: 600 }}
          >
            {hasChanges ? "Salvar alteração" : "Salvo"}
          </Button>
        </>
      )}
    </div>
  );
}
