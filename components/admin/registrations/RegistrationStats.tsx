"use client";

import React from "react";
import { Card, Statistic } from "antd";
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
  };
  /** false para perfis sem acesso a valores financeiros (ADR-002) */
  showValues?: boolean;
}

export default function RegistrationStats({
  stats,
  showValues = true,
}: RegistrationStatsProps) {
  const showRevenue = showValues && stats.totalRevenue != null;
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
      </div>
    </div>
  );
}
