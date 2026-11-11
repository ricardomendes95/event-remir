"use client";

import React from "react";
import { Card, Statistic, Tag, Space } from "antd";
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

interface RegistrationStatsProps {
  stats: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    totalRevenue: number | null;
    nonManualRevenue: number | null;
    /** Inscrições manuais por sub-método (contagem; não é valor financeiro) */
    manualByType?: { PIX: number; CASH: number; CARD: number; NOT_INFORMED: number };
    /** null para CHECKIN (não vê observação) */
    withNotes?: number | null;
    /** null para quem não vê valores */
    openRefunds?: number | null;
  };
  /** false para perfis sem acesso a valores financeiros (ADR-002) */
  showValues?: boolean;
}

export default function RegistrationStats({
  stats,
  showValues = true,
}: RegistrationStatsProps) {
  const showRevenue = showValues && stats.totalRevenue != null;
  const manual = stats.manualByType;
  const hasManual =
    !!manual && manual.PIX + manual.CASH + manual.CARD + manual.NOT_INFORMED > 0;
  return (
    <div
      className="mb-6"
      style={{
        overflowX: "auto",
        paddingBottom: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "16px",
          minWidth: "560px", // 5 cards × 112px cada
          width: "100%",
        }}
      >
        <div style={{ minWidth: "178px", flex: "1" }}>
          <Card>
            <Statistic
              title="Total de Inscrições"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </div>
        <div style={{ minWidth: "178px", flex: "1" }}>
          <Card>
            <Statistic
              title="Confirmadas"
              value={stats.confirmed}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </div>
        <div style={{ minWidth: "178px", flex: "1" }}>
          <Card>
            <Statistic
              title="Pendentes"
              value={stats.pending}
              prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </div>
        {showRevenue && (
          <div style={{ minWidth: "178px", flex: "1" }}>
            <Card>
              <Statistic
                title="Inscritos no Site"
                value={(stats.nonManualRevenue ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                precision={2}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </div>
        )}
        {showRevenue && (
          <div style={{ minWidth: "178px", flex: "1" }}>
            <Card>
              <Statistic
                title="Receita Total"
                value={(stats.totalRevenue ?? 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
                precision={2}
                valueStyle={{ color: "#1890ff" }}
              />
            </Card>
          </div>
        )}
        {stats.openRefunds != null && (
          <div style={{ minWidth: "178px", flex: "1" }}>
            <Card>
              <Statistic
                title="Estornos em aberto"
                value={stats.openRefunds}
                valueStyle={{ color: stats.openRefunds > 0 ? "#fa541c" : undefined }}
              />
            </Card>
          </div>
        )}
      </div>
      {hasManual && manual && (
        <Space size={[8, 8]} wrap className="mt-3" data-testid="manual-breakdown">
          <span className="text-sm text-gray-500">Pagamentos manuais:</span>
          <Tag>Pix: {manual.PIX}</Tag>
          <Tag>Dinheiro: {manual.CASH}</Tag>
          <Tag>Cartão: {manual.CARD}</Tag>
          {manual.NOT_INFORMED > 0 && (
            <Tag>Não informado: {manual.NOT_INFORMED}</Tag>
          )}
          {stats.withNotes != null && (
            <Tag color="blue">Com observação: {stats.withNotes}</Tag>
          )}
        </Space>
      )}
    </div>
  );
}
