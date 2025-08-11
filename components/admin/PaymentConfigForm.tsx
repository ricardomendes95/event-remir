import React from "react";
import {
  Card,
  Switch,
  InputNumber,
  Row,
  Col,
  Typography,
  Alert,
  Space,
  Divider,
} from "antd";
import {
  CreditCardOutlined,
  QrcodeOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { PaymentConfig } from "@/backend/schemas/eventSchemas";
import { getPaymentMethodName } from "@/utils/paymentMethods";

const { Title, Text } = Typography;

interface PaymentConfigFormProps {
  value?: PaymentConfig;
  onChange?: (config: PaymentConfig) => void;
  eventPrice?: number;
}

// Taxas padrão para simulação
const DEFAULT_FEES = {
  pix: 0.0099, // 0,99%
  debit_card: 0.0299, // 2,99%
  credit_card: {
    1: 0.0499, // 4,99%
    2: 0.0599, // 5,99%
    3: 0.0699, // 6,99%
    6: 0.0999, // 9,99%
    12: 0.1599, // 15,99%
  },
} as const;

export const PaymentConfigForm: React.FC<PaymentConfigFormProps> = ({
  value,
  onChange,
  eventPrice = 100,
}) => {
  // Configuração padrão
  const defaultConfig: PaymentConfig = {
    methods: {
      pix: {
        enabled: true,
        passthrough_fee: false,
      },
      credit_card: {
        enabled: true,
        max_installments: 12,
        passthrough_fee: false,
      },
      debit_card: {
        enabled: true,
        passthrough_fee: false,
      },
    },
    default_method: "pix",
  };

  // Garantir que a estrutura do config está completa - LÓGICA DE NEGÓCIO PRESERVADA
  const safeConfig: PaymentConfig = {
    methods: {
      pix: {
        enabled:
          value?.methods?.pix?.enabled ?? defaultConfig.methods.pix.enabled,
        passthrough_fee:
          value?.methods?.pix?.passthrough_fee ??
          defaultConfig.methods.pix.passthrough_fee,
      },
      credit_card: {
        enabled:
          value?.methods?.credit_card?.enabled ??
          defaultConfig.methods.credit_card.enabled,
        max_installments:
          value?.methods?.credit_card?.max_installments ??
          defaultConfig.methods.credit_card.max_installments,
        passthrough_fee:
          value?.methods?.credit_card?.passthrough_fee ??
          defaultConfig.methods.credit_card.passthrough_fee,
      },
      debit_card: {
        enabled:
          value?.methods?.debit_card?.enabled ??
          defaultConfig.methods.debit_card.enabled,
        passthrough_fee:
          value?.methods?.debit_card?.passthrough_fee ??
          defaultConfig.methods.debit_card.passthrough_fee,
      },
    },
    default_method: value?.default_method || defaultConfig.default_method,
  };

  const updateConfig = (updates: Partial<PaymentConfig>) => {
    const newConfig = { ...safeConfig, ...updates };
    onChange?.(newConfig);
  };

  const updateMethodConfig = (
    method: keyof PaymentConfig["methods"],
    updates: Partial<PaymentConfig["methods"][keyof PaymentConfig["methods"]]>
  ) => {
    const newMethods = {
      ...safeConfig.methods,
      [method]: { ...safeConfig.methods[method], ...updates },
    };
    updateConfig({ methods: newMethods });
  };

  const calculateFeeAmount = (method: string, installments?: number) => {
    let feeRate = 0;

    if (method === "pix") {
      feeRate = DEFAULT_FEES.pix;
    } else if (method === "debit_card") {
      feeRate = DEFAULT_FEES.debit_card;
    } else if (method === "credit_card" && installments) {
      feeRate =
        DEFAULT_FEES.credit_card[
          installments as keyof typeof DEFAULT_FEES.credit_card
        ] || DEFAULT_FEES.credit_card[12];
    }

    return eventPrice * feeRate;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="payment-config-form">
      <Title level={4}>
        <CreditCardOutlined /> Configuração de Métodos de Pagamento
      </Title>

      <Alert
        message="Configure como os participantes poderão pagar pela inscrição"
        description="Você pode escolher quais métodos aceitar e se as taxas serão repassadas para o participante."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={[16, 16]}>
        {/* PIX */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <QrcodeOutlined style={{ color: "#00C851" }} />
                {getPaymentMethodName("pix")}
              </Space>
            }
            className={safeConfig.methods.pix.enabled ? "border-green" : ""}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>Habilitar {getPaymentMethodName("pix")}</Text>
                <Switch
                  checked={safeConfig.methods.pix.enabled}
                  onChange={(enabled) => updateMethodConfig("pix", { enabled })}
                />
              </div>

              {safeConfig.methods.pix.enabled && (
                <>
                  <Divider />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>Repassar taxa para o participante</Text>
                    <Switch
                      checked={safeConfig.methods.pix.passthrough_fee}
                      onChange={(passthrough_fee) =>
                        updateMethodConfig("pix", { passthrough_fee })
                      }
                    />
                  </div>

                  <Alert
                    message={
                      <Space direction="vertical" size="small">
                        <Text>
                          <strong>Taxa PIX:</strong>{" "}
                          {(DEFAULT_FEES.pix * 100).toFixed(2)}%
                        </Text>
                        <Text>
                          <strong>Valor da taxa:</strong>{" "}
                          {formatCurrency(calculateFeeAmount("pix"))}
                        </Text>
                        <Text>
                          <strong>
                            {safeConfig.methods.pix.passthrough_fee ? (
                              <>
                                Participante pagará:{" "}
                                {formatCurrency(
                                  eventPrice + calculateFeeAmount("pix")
                                )}
                              </>
                            ) : (
                              <>
                                Participante pagará:{" "}
                                {formatCurrency(eventPrice)}
                                <br />
                                Você receberá:{" "}
                                {formatCurrency(
                                  eventPrice - calculateFeeAmount("pix")
                                )}
                              </>
                            )}
                          </strong>
                        </Text>
                      </Space>
                    }
                    type="info"
                  />
                </>
              )}
            </Space>
          </Card>
        </Col>

        {/* Cartão de Crédito */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <CreditCardOutlined style={{ color: "#007bff" }} />
                {getPaymentMethodName("credit_card")}
              </Space>
            }
            className={
              safeConfig.methods.credit_card.enabled ? "border-blue" : ""
            }
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>
                  Habilitar {getPaymentMethodName("credit_card")}
                </Text>
                <Switch
                  checked={safeConfig.methods.credit_card.enabled}
                  onChange={(enabled) =>
                    updateMethodConfig("credit_card", { enabled })
                  }
                />
              </div>

              {safeConfig.methods.credit_card.enabled && (
                <>
                  <Divider />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>Máximo de parcelas</Text>
                    <InputNumber
                      min={1}
                      max={12}
                      value={safeConfig.methods.credit_card.max_installments}
                      onChange={(value) =>
                        updateMethodConfig("credit_card", {
                          max_installments: value || 1,
                        })
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>Repassar taxa para o participante</Text>
                    <Switch
                      checked={safeConfig.methods.credit_card.passthrough_fee}
                      onChange={(passthrough_fee) =>
                        updateMethodConfig("credit_card", { passthrough_fee })
                      }
                    />
                  </div>

                  <Alert
                    message={
                      <Space direction="vertical" size="small">
                        <Text>
                          <strong>À vista:</strong> {formatCurrency(eventPrice)}{" "}
                          (Taxa:{" "}
                          {(DEFAULT_FEES.credit_card[1] * 100).toFixed(2)}%)
                        </Text>
                        {safeConfig.methods.credit_card.passthrough_fee ? (
                          <Text>
                            Participante pagará:{" "}
                            {formatCurrency(
                              eventPrice + calculateFeeAmount("credit_card", 1)
                            )}
                          </Text>
                        ) : (
                          <Text>
                            Você receberá:{" "}
                            {formatCurrency(
                              eventPrice - calculateFeeAmount("credit_card", 1)
                            )}
                          </Text>
                        )}

                        {safeConfig.methods.credit_card.max_installments >
                          1 && (
                          <Text>
                            <strong>
                              Em{" "}
                              {safeConfig.methods.credit_card.max_installments}
                              x:{" "}
                              {formatCurrency(
                                (safeConfig.methods.credit_card.passthrough_fee
                                  ? eventPrice +
                                    calculateFeeAmount(
                                      "credit_card",
                                      safeConfig.methods.credit_card
                                        .max_installments
                                    )
                                  : eventPrice) /
                                  safeConfig.methods.credit_card
                                    .max_installments
                              )}{" "}
                              por parcela
                            </strong>
                          </Text>
                        )}
                      </Space>
                    }
                    type="info"
                  />
                </>
              )}
            </Space>
          </Card>
        </Col>

        {/* Cartão de Débito */}
        <Col span={24}>
          <Card
            title={
              <Space>
                <BankOutlined style={{ color: "#dc3545" }} />
                {getPaymentMethodName("debit_card")}
              </Space>
            }
            className={
              safeConfig.methods.debit_card.enabled ? "border-red" : ""
            }
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>
                  Habilitar {getPaymentMethodName("debit_card")}
                </Text>
                <Switch
                  checked={safeConfig.methods.debit_card.enabled}
                  onChange={(enabled) =>
                    updateMethodConfig("debit_card", { enabled })
                  }
                />
              </div>

              {safeConfig.methods.debit_card.enabled && (
                <>
                  <Divider />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text>Repassar taxa para o participante</Text>
                    <Switch
                      checked={safeConfig.methods.debit_card.passthrough_fee}
                      onChange={(passthrough_fee) =>
                        updateMethodConfig("debit_card", { passthrough_fee })
                      }
                    />
                  </div>

                  <Alert
                    message={
                      <Space direction="vertical" size="small">
                        <Text>
                          <strong>Taxa Débito:</strong>{" "}
                          {(DEFAULT_FEES.debit_card * 100).toFixed(2)}%
                        </Text>
                        <Text>
                          <strong>Valor da taxa:</strong>{" "}
                          {formatCurrency(calculateFeeAmount("debit_card"))}
                        </Text>
                        <Text>
                          <strong>
                            {safeConfig.methods.debit_card.passthrough_fee ? (
                              <>
                                Participante pagará:{" "}
                                {formatCurrency(
                                  eventPrice + calculateFeeAmount("debit_card")
                                )}
                              </>
                            ) : (
                              <>
                                Participante pagará:{" "}
                                {formatCurrency(eventPrice)}
                                <br />
                                Você receberá:{" "}
                                {formatCurrency(
                                  eventPrice - calculateFeeAmount("debit_card")
                                )}
                              </>
                            )}
                          </strong>
                        </Text>
                      </Space>
                    }
                    type="info"
                  />
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Método Padrão */}
      <Divider />
      <div style={{ marginTop: 24 }}>
        <Text strong>Método de Pagamento Padrão:</Text>
        <div style={{ marginTop: 8 }}>
          <select
            value={safeConfig.default_method}
            onChange={(e) =>
              updateConfig({
                default_method: e.target
                  .value as PaymentConfig["default_method"],
              })
            }
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #d9d9d9",
              borderRadius: "6px",
            }}
          >
            {safeConfig.methods.pix.enabled && (
              <option value="pix">{getPaymentMethodName("pix")}</option>
            )}
            {safeConfig.methods.credit_card.enabled && (
              <option value="credit_card">
                {getPaymentMethodName("credit_card")}
              </option>
            )}
            {safeConfig.methods.debit_card.enabled && (
              <option value="debit_card">
                {getPaymentMethodName("debit_card")}
              </option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
