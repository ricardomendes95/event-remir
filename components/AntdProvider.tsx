"use client";

import "@ant-design/v5-patch-for-react-19";
import { ConfigProvider } from "antd";
import ptBR from "antd/locale/pt_BR";
import React from "react";

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={ptBR} warning={{ strict: false }}>
      {children}
    </ConfigProvider>
  );
}
