import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Radio,
  Spin,
  Alert,
  Space,
  Typography,
  Divider,
  Button,
} from "antd";
import {
  QrcodeOutlined,
  CreditCardOutlined,
  BankOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import styles from "./PaymentMethodSelector.module.css";

const { Text, Title } = Typography;

interface PaymentOption {
  method: "pix" | "credit_card" | "debit_card";
  installments?: number;
  enabled: boolean;
  fee_percentage: number;
  base_value: number;
  fee_amount: number;
  final_value: number;
  description: string;
  passthrough_fee: boolean;
}

interface PaymentCalculation {
  base_value: number;
  available_methods: PaymentOption[];
  default_method?: string;
}

interface PaymentMethodSelectorProps {
  eventId: string;
  eventTitle?: string;
  onSelectionChange?: (selection: {
    method: string;
    installments?: number;
    finalValue: number;
    description: string;
  }) => void;
  disabled?: boolean;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  eventId,
  eventTitle = "Evento",
  onSelectionChange,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [paymentOptions, setPaymentOptions] =
    useState<PaymentCalculation | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [groupedOptions, setGroupedOptions] = useState<
    Record<string, PaymentOption[]>
  >({});

  //   const groupedOptions = groupOptionsByMethod();
  const [selectedOption, setSelectedOption] = useState<PaymentOption | null>(
    null
  );

  // Buscar opções de pagamento ao montar o componente
  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/events/${eventId}/payment-methods`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar métodos de pagamento");
      }

      setPaymentOptions(data.data);

      // Selecionar método padrão se disponível
      if (data.default_method && data.available_methods.length > 0) {
        const defaultOption = data.available_methods.find(
          (opt: PaymentOption) => opt.method === data.default_method
        );
        if (defaultOption) {
          const methodKey = `${defaultOption.method}-${
            defaultOption.installments || 1
          }`;
          setSelectedMethod(methodKey);

          // Notificar seleção inicial
          onSelectionChange?.({
            method: defaultOption.method,
            installments: defaultOption.installments || 1,
            finalValue: defaultOption.final_value,
            description: defaultOption.description,
          });
        }
      }
    } catch (err) {
      console.error("Erro ao buscar métodos de pagamento:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [eventId, onSelectionChange]); // useCallback dependency

  useEffect(() => {
    if (eventId) {
      fetchPaymentMethods();
    }
  }, [eventId, fetchPaymentMethods]);

  useEffect(() => {
    if (paymentOptions) {
      const groupOptionsByMethod = () => {
        if (!paymentOptions?.available_methods) return {};
        return paymentOptions.available_methods.reduce((acc, option) => {
          if (!acc[option.method]) {
            acc[option.method] = [];
          }
          acc[option.method].push(option);
          return acc;
        }, {} as Record<string, PaymentOption[]>);
      };

      const group = groupOptionsByMethod();
      setGroupedOptions(group);
      const payment = paymentOptions?.available_methods?.find(
        (opt) => `${opt.method}-${opt.installments || 1}` === selectedMethod
      );
      setSelectedOption(payment || null);
    }
  }, [paymentOptions, selectedMethod]);

  const handleSelectionChange = (option: PaymentOption) => {
    onSelectionChange?.({
      method: option.method,
      installments: option.installments || 1,
      finalValue: option.final_value,
      description: option.description,
    });
  };

  const handleMethodChange = (value: string) => {
    setSelectedMethod(value);

    const [method, installmentsStr] = value.split("-");
    const installments = parseInt(installmentsStr) || 1;

    const option = paymentOptions?.available_methods.find(
      (opt) => opt.method === method && (opt.installments || 1) === installments
    );

    if (option) {
      handleSelectionChange(option);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "pix":
        return <QrcodeOutlined style={{ color: "#00C851", fontSize: 18 }} />;
      case "credit_card":
        return (
          <CreditCardOutlined style={{ color: "#007bff", fontSize: 18 }} />
        );
      case "debit_card":
        return <BankOutlined style={{ color: "#ff6b6b", fontSize: 18 }} />;
      default:
        return <InfoCircleOutlined />;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "pix":
        return "#00C851";
      case "credit_card":
        return "#007bff";
      case "debit_card":
        return "#ff6b6b";
      default:
        return "#666";
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Carregando métodos de pagamento...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert
          message="Erro ao carregar métodos de pagamento"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchPaymentMethods}>
              Tentar novamente
            </Button>
          }
        />
      </Card>
    );
  }

  if (!paymentOptions || paymentOptions.available_methods?.length === 0) {
    return (
      <Card>
        <Alert
          message="Nenhum método de pagamento disponível"
          description="Este evento não possui métodos de pagamento configurados"
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <CreditCardOutlined />
          Escolha o método de pagamento
        </Space>
      }
      className={styles.paymentMethodSelector}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Selecione como deseja pagar pela inscrição em:{" "}
          <strong>{eventTitle}</strong>
        </Text>
      </div>

      <Radio.Group
        value={selectedMethod}
        onChange={(e) => handleMethodChange(e.target.value)}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {Object.entries(groupedOptions).map(([method, options]) => (
            <div key={method}>
              {options.map((option) => {
                const radioValue = `${option.method}-${
                  option.installments || 1
                }`;
                const isSelected = selectedMethod === radioValue;

                return (
                  <Card
                    key={radioValue}
                    size="small"
                    className={styles.methodCard}
                    data-selected={isSelected}
                    style={{
                      border: isSelected
                        ? `2px solid ${getMethodColor(method)}`
                        : "1px solid #d9d9d9",
                      backgroundColor: isSelected ? "#fafafa" : "white",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.6 : 1,
                      boxShadow: isSelected
                        ? `0 2px 8px ${getMethodColor(method)}20`
                        : "0 1px 4px rgba(0,0,0,0.05)",
                    }}
                    onClick={() => !disabled && handleMethodChange(radioValue)}
                    bodyStyle={{
                      padding: "16px",
                    }}
                  >
                    <div className={styles.methodContent}>
                      {/* Linha principal com método e valor */}
                      <div className={styles.methodMainRow}>
                        <Space size={12} className={styles.methodInfo}>
                          {getMethodIcon(method)}
                          <Text strong style={{ fontSize: "16px" }}>
                            {option.description}
                          </Text>
                        </Space>
                        <div className={styles.methodPrice}>
                          <Text
                            strong
                            style={{
                              color: getMethodColor(method),
                              fontSize: "20px",
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                          >
                            {formatCurrency(option.final_value)}
                          </Text>
                          {option.installments && option.installments > 1 && (
                            <div style={{ marginTop: "4px" }}>
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: "13px",
                                  display: "block",
                                  fontWeight: 500,
                                }}
                              >
                                {option.installments}x de{" "}
                                {formatCurrency(
                                  option.final_value / option.installments
                                )}
                              </Text>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Taxa de serviço em linha separada para mobile */}
                      {option.passthrough_fee && (
                        <div className={styles.methodFee}>
                          <Text
                            type="secondary"
                            style={{
                              fontSize: "13px",
                              color: "#666",
                            }}
                          >
                            Taxa de serviço: {formatCurrency(option.fee_amount)}{" "}
                            ({(option.fee_percentage * 100).toFixed(2)}%)
                          </Text>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </Space>
      </Radio.Group>

      {selectedOption && (
        <>
          <Divider />
          <div
            className={styles.summaryContainer}
            style={{
              border: `2px solid ${getMethodColor(selectedOption.method)}40`,
            }}
          >
            <Title
              level={4}
              className={styles.summaryTitle}
              style={{
                color: getMethodColor(selectedOption.method),
              }}
            >
              {getMethodIcon(selectedOption.method)}
              Resumo do Pagamento
            </Title>
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <div className={styles.summaryRow}>
                <Text style={{ fontSize: "15px" }}>Valor da inscrição:</Text>
                <Text style={{ fontSize: "15px", fontWeight: 500 }}>
                  {formatCurrency(selectedOption.base_value)}
                </Text>
              </div>
              {selectedOption.passthrough_fee &&
                selectedOption.fee_amount > 0 && (
                  <div className={styles.summaryRow}>
                    <Text style={{ fontSize: "15px" }}>Taxa de serviço:</Text>
                    <Text style={{ fontSize: "15px", fontWeight: 500 }}>
                      {formatCurrency(selectedOption.fee_amount)}
                    </Text>
                  </div>
                )}
              <Divider style={{ margin: "12px 0" }} />
              <div
                className={styles.summaryTotal}
                style={{
                  border: `1px solid ${getMethodColor(
                    selectedOption.method
                  )}30`,
                }}
              >
                <Text strong style={{ fontSize: "16px" }}>
                  Total a pagar:
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: getMethodColor(selectedOption.method),
                    lineHeight: 1,
                    textShadow: `0 1px 2px ${getMethodColor(
                      selectedOption.method
                    )}20`,
                  }}
                >
                  {formatCurrency(selectedOption.final_value)}
                </Text>
              </div>
              {selectedOption.installments &&
                selectedOption.installments > 1 && (
                  <div className={styles.installmentInfo}>
                    <Text
                      style={{
                        fontSize: "14px",
                        color: getMethodColor(selectedOption.method),
                        fontWeight: 500,
                      }}
                    >
                      Ou {selectedOption.installments}x de{" "}
                      {formatCurrency(
                        selectedOption.final_value / selectedOption.installments
                      )}
                    </Text>
                  </div>
                )}
            </Space>
          </div>
        </>
      )}
    </Card>
  );
};
