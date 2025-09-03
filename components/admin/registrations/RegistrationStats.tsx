"use client";

import React from "react";
import { Card, Row, Col, Statistic } from "antd";
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
    totalRevenue: number;
    nonManualRevenue: number;
  };
}

export default function RegistrationStats({ stats }: RegistrationStatsProps) {
  return (
    <Row gutter={16} className="mb-6">
      <Col span={4}>
        <Card>
          <Statistic
            title="Total de Inscrições"
            value={stats.total}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="Confirmadas"
            value={stats.confirmed}
            prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="Pendentes"
            value={stats.pending}
            prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
            valueStyle={{ color: "#faad14" }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="Inscritos no Site"
            value={stats.nonManualRevenue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            precision={2}
            valueStyle={{ color: "#1890ff" }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="Receita Total"
            value={stats.totalRevenue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            precision={2}
            valueStyle={{ color: "#1890ff" }}
          />
        </Card>
      </Col>
    </Row>
  );
}
