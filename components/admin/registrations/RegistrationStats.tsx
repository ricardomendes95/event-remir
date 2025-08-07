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
  };
}

export default function RegistrationStats({ stats }: RegistrationStatsProps) {
  return (
    <Row gutter={16} className="mb-6">
      <Col span={6}>
        <Card>
          <Statistic
            title="Total de Inscrições"
            value={stats.total}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Confirmadas"
            value={stats.confirmed}
            prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Pendentes"
            value={stats.pending}
            prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
            valueStyle={{ color: "#faad14" }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="Receita Total"
            value={stats.totalRevenue}
            precision={2}
            prefix="R$"
            valueStyle={{ color: "#1890ff" }}
          />
        </Card>
      </Col>
    </Row>
  );
}
