"use client";

import React, { useCallback } from "react";
import {
  Card,
  Button,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import type { DynamicField } from "@/backend/schemas/dynamicFormSchemas";

const { Text } = Typography;

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "phone", label: "Telefone" },
  { value: "cpf", label: "CPF" },
  { value: "select", label: "Lista suspensa" },
  { value: "radio", label: "Múltipla escolha (radio)" },
  { value: "checkbox", label: "Caixa de seleção" },
];

function toFieldId(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

function makeEmptyField(): DynamicField {
  return {
    id: `campo_${Date.now()}`,
    type: "text",
    label: "",
    required: false,
  } as DynamicField;
}

interface OptionItem {
  value: string;
  label: string;
}

interface DynamicFormBuilderProps {
  value?: DynamicField[];
  onChange?: (fields: DynamicField[]) => void;
  disabled?: boolean;
}

export const DynamicFormBuilder: React.FC<DynamicFormBuilderProps> = ({
  value = [],
  onChange,
  disabled = false,
}) => {
  const emit = useCallback(
    (next: DynamicField[]) => onChange?.(next),
    [onChange]
  );

  const addField = () => {
    if (value.length >= 30) return;
    emit([...value, makeEmptyField()]);
  };

  const removeField = (idx: number) => {
    emit(value.filter((_, i) => i !== idx));
  };

  const duplicateField = (idx: number) => {
    if (value.length >= 30) return;
    const copy = {
      ...JSON.parse(JSON.stringify(value[idx])),
      id: `${value[idx].id}_copia`,
    };
    const next = [...value];
    next.splice(idx + 1, 0, copy);
    emit(next);
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    emit(next);
  };

  const updateField = (idx: number, patch: Partial<DynamicField>) => {
    const next = value.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    emit(next as DynamicField[]);
  };

  const updateOptions = (
    idx: number,
    optIdx: number,
    key: "value" | "label",
    val: string
  ) => {
    const field = value[idx] as DynamicField & { options: OptionItem[] };
    const opts = [...(field.options ?? [])];
    opts[optIdx] = { ...opts[optIdx], [key]: val };
    updateField(idx, { options: opts } as Partial<DynamicField>);
  };

  const addOption = (idx: number) => {
    const field = value[idx] as DynamicField & { options?: OptionItem[] };
    const opts = [...(field.options ?? []), { value: "", label: "" }];
    updateField(idx, { options: opts } as Partial<DynamicField>);
  };

  const removeOption = (idx: number, optIdx: number) => {
    const field = value[idx] as DynamicField & { options: OptionItem[] };
    const opts = field.options.filter((_, i) => i !== optIdx);
    updateField(idx, { options: opts } as Partial<DynamicField>);
  };

  // Detectar IDs duplicados
  const idCounts = value.reduce<Record<string, number>>((acc, f) => {
    acc[f.id] = (acc[f.id] ?? 0) + 1;
    return acc;
  }, {});

  if (disabled && value.length === 0) {
    return (
      <Alert
        type="warning"
        message="Não é possível alterar os campos dinâmicos de um evento com inscrições"
        showIcon
      />
    );
  }

  return (
    <div>
      {disabled && value.length > 0 && (
        <Alert
          type="warning"
          message="Evento com inscrições — campos dinâmicos bloqueados para edição"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}

      <Space direction="vertical" style={{ width: "100%" }}>
        {value.map((field, idx) => {
          const hasDupId = (idCounts[field.id] ?? 0) > 1;
          const hasOptions =
            field.type === "select" ||
            field.type === "radio" ||
            field.type === "checkbox";
          const fieldWithOpts = field as DynamicField & {
            options?: OptionItem[];
            multi?: boolean;
            minLength?: number;
            maxLength?: number;
            placeholder?: string;
            min?: number;
            max?: number;
            integer?: boolean;
            helpText?: string;
          };

          return (
            <Card
              key={idx}
              size="small"
              title={
                <Space>
                  <Text strong style={{ color: "#666" }}>
                    #{idx + 1}
                  </Text>
                  <Text>{field.label || "(sem título)"}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    [{field.type}]
                  </Text>
                </Space>
              }
              extra={
                !disabled && (
                  <Space size={4}>
                    <Tooltip title="Mover para cima">
                      <Button
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={idx === 0}
                        onClick={() => moveField(idx, -1)}
                      />
                    </Tooltip>
                    <Tooltip title="Mover para baixo">
                      <Button
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={idx === value.length - 1}
                        onClick={() => moveField(idx, 1)}
                      />
                    </Tooltip>
                    <Tooltip title="Duplicar">
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        disabled={value.length >= 30}
                        onClick={() => duplicateField(idx)}
                      />
                    </Tooltip>
                    <Tooltip title="Remover">
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeField(idx)}
                      />
                    </Tooltip>
                  </Space>
                )
              }
            >
              <Row gutter={[12, 12]}>
                {/* Tipo */}
                <Col xs={24} sm={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Tipo
                    </Text>
                    <Select
                      style={{ width: "100%", marginTop: 4 }}
                      value={field.type}
                      disabled={disabled}
                      options={FIELD_TYPE_OPTIONS}
                      onChange={(t) => {
                        const base = {
                          id: field.id,
                          label: field.label,
                          required: field.required,
                          helpText: fieldWithOpts.helpText,
                        };
                        const next: DynamicField =
                          t === "select" || t === "radio" || t === "checkbox"
                            ? ({
                                ...base,
                                type: t,
                                options: [],
                                ...(t === "checkbox" ? { multi: false } : {}),
                              } as unknown as DynamicField)
                            : ({ ...base, type: t } as DynamicField);
                        updateField(idx, next);
                      }}
                    />
                  </div>
                </Col>

                {/* Label */}
                <Col xs={24} sm={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Rótulo
                    </Text>
                    <Input
                      style={{ marginTop: 4 }}
                      value={field.label}
                      disabled={disabled}
                      placeholder="Nome do campo exibido ao participante"
                      maxLength={120}
                      onChange={(e) => {
                        const label = e.target.value;
                        const autoId =
                          field.id === "" || field.id.startsWith("campo_")
                            ? toFieldId(label) || field.id
                            : field.id;
                        updateField(idx, { label, id: autoId } as Partial<DynamicField>);
                      }}
                    />
                  </div>
                </Col>

                {/* ID */}
                <Col xs={24} sm={12}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ID (identificador único)
                    </Text>
                    <Input
                      style={{ marginTop: 4 }}
                      value={field.id}
                      disabled={disabled}
                      placeholder="identificador_unico"
                      status={hasDupId ? "error" : undefined}
                      onChange={(e) =>
                        updateField(idx, {
                          id: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "")
                            .slice(0, 40),
                        } as Partial<DynamicField>)
                      }
                    />
                    {hasDupId && (
                      <Text type="danger" style={{ fontSize: 11 }}>
                        ID duplicado
                      </Text>
                    )}
                  </div>
                </Col>

                {/* Obrigatório */}
                <Col xs={24} sm={12}>
                  <div style={{ paddingTop: 22 }}>
                    <Space>
                      <Switch
                        size="small"
                        checked={field.required}
                        disabled={disabled}
                        onChange={(v) =>
                          updateField(idx, { required: v } as Partial<DynamicField>)
                        }
                      />
                      <Text>Obrigatório</Text>
                    </Space>
                  </div>
                </Col>

                {/* Texto de ajuda */}
                <Col xs={24}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Texto de ajuda (opcional)
                    </Text>
                    <Input
                      style={{ marginTop: 4 }}
                      value={fieldWithOpts.helpText ?? ""}
                      disabled={disabled}
                      placeholder="Instrução exibida abaixo do campo"
                      onChange={(e) =>
                        updateField(idx, {
                          helpText: e.target.value || undefined,
                        } as Partial<DynamicField>)
                      }
                    />
                  </div>
                </Col>

                {/* Configurações específicas por tipo */}
                {(field.type === "text" || field.type === "textarea") && (
                  <>
                    <Col xs={12} sm={6}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Mín. caracteres
                        </Text>
                        <InputNumber
                          style={{ width: "100%", marginTop: 4 }}
                          min={0}
                          max={5000}
                          value={fieldWithOpts.minLength}
                          disabled={disabled}
                          onChange={(v) =>
                            updateField(idx, {
                              minLength: v ?? undefined,
                            } as Partial<DynamicField>)
                          }
                        />
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Máx. caracteres
                        </Text>
                        <InputNumber
                          style={{ width: "100%", marginTop: 4 }}
                          min={1}
                          max={5000}
                          value={fieldWithOpts.maxLength}
                          disabled={disabled}
                          onChange={(v) =>
                            updateField(idx, {
                              maxLength: v ?? undefined,
                            } as Partial<DynamicField>)
                          }
                        />
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Placeholder
                        </Text>
                        <Input
                          style={{ marginTop: 4 }}
                          value={fieldWithOpts.placeholder ?? ""}
                          disabled={disabled}
                          onChange={(e) =>
                            updateField(idx, {
                              placeholder: e.target.value || undefined,
                            } as Partial<DynamicField>)
                          }
                        />
                      </div>
                    </Col>
                  </>
                )}

                {field.type === "number" && (
                  <>
                    <Col xs={12} sm={6}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Mínimo
                        </Text>
                        <InputNumber
                          style={{ width: "100%", marginTop: 4 }}
                          value={fieldWithOpts.min}
                          disabled={disabled}
                          onChange={(v) =>
                            updateField(idx, {
                              min: v ?? undefined,
                            } as Partial<DynamicField>)
                          }
                        />
                      </div>
                    </Col>
                    <Col xs={12} sm={6}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Máximo
                        </Text>
                        <InputNumber
                          style={{ width: "100%", marginTop: 4 }}
                          value={fieldWithOpts.max}
                          disabled={disabled}
                          onChange={(v) =>
                            updateField(idx, {
                              max: v ?? undefined,
                            } as Partial<DynamicField>)
                          }
                        />
                      </div>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ paddingTop: 22 }}>
                        <Space>
                          <Switch
                            size="small"
                            checked={fieldWithOpts.integer ?? false}
                            disabled={disabled}
                            onChange={(v) =>
                              updateField(idx, {
                                integer: v,
                              } as Partial<DynamicField>)
                            }
                          />
                          <Text>Somente inteiros</Text>
                        </Space>
                      </div>
                    </Col>
                  </>
                )}

                {field.type === "checkbox" && (
                  <Col xs={24}>
                    <Space style={{ paddingTop: 4 }}>
                      <Switch
                        size="small"
                        checked={fieldWithOpts.multi ?? false}
                        disabled={disabled}
                        onChange={(v) =>
                          updateField(idx, {
                            multi: v,
                          } as Partial<DynamicField>)
                        }
                      />
                      <Text>Permitir múltiplas seleções</Text>
                    </Space>
                  </Col>
                )}

                {hasOptions && (
                  <Col xs={24}>
                    <Divider style={{ margin: "8px 0" }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Opções
                    </Text>
                    <Space
                      direction="vertical"
                      style={{ width: "100%", marginTop: 8 }}
                    >
                      {(fieldWithOpts.options ?? []).map((opt, optIdx) => (
                        <Row key={optIdx} gutter={8} align="middle">
                          <Col flex="1">
                            <Input
                              placeholder="Rótulo da opção"
                              value={opt.label}
                              disabled={disabled}
                              onChange={(e) =>
                                updateOptions(idx, optIdx, "label", e.target.value)
                              }
                            />
                          </Col>
                          <Col flex="1">
                            <Input
                              placeholder="Valor (sem espaços)"
                              value={opt.value}
                              disabled={disabled}
                              onChange={(e) =>
                                updateOptions(
                                  idx,
                                  optIdx,
                                  "value",
                                  e.target.value.replace(/\s/g, "_")
                                )
                              }
                            />
                          </Col>
                          {!disabled && (
                            <Col>
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeOption(idx, optIdx)}
                              />
                            </Col>
                          )}
                        </Row>
                      ))}
                      {!disabled && (
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => addOption(idx)}
                        >
                          Adicionar opção
                        </Button>
                      )}
                    </Space>
                  </Col>
                )}
              </Row>
            </Card>
          );
        })}

        {!disabled && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addField}
            disabled={value.length >= 30}
            style={{ width: "100%" }}
          >
            Adicionar campo ({value.length}/30)
          </Button>
        )}
      </Space>
    </div>
  );
};
