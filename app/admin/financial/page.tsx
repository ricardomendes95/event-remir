"use client";

import React from "react";
import { Tabs, Typography } from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import FinancialSummaryTab from "@/components/admin/financial/FinancialSummaryTab";

const { Title, Text } = Typography;

// Abas do Financeiro. A aba "Auditoria" (req. 6) entra aqui como novo item.
const TAB_ITEMS = [
  {
    key: "summary",
    label: "Prestação de contas",
    children: <FinancialSummaryTab />,
  },
];

export default function FinancialPage() {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-4 print:hidden">
        <Title level={2} className="!mb-1">
          <BarChartOutlined className="mr-2" />
          Financeiro
        </Title>
        <Text type="secondary">
          Prestação de contas dos eventos: recebido, taxas, estornos e líquido.
        </Text>
      </div>
      <Tabs items={TAB_ITEMS} defaultActiveKey="summary" />
    </div>
  );
}
