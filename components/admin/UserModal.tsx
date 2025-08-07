"use client";

import React from "react";
import { Modal, Form, Input, Select, Button, Row, Col, Switch } from "antd";
import type { FormInstance } from "antd";
import { z } from "zod";
import { User } from "../../types/user";

const { Option } = Select;

// Schema de validação para usuário - baseado no backend
const userSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().email("Email inválido").toLowerCase(),
  password: z
    .string()
    .min(6, "Senha deve ter pelo menos 6 caracteres")
    .max(100, "Senha deve ter no máximo 100 caracteres"),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .optional(),
  email: z.string().email("Email inválido").toLowerCase().optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
}

interface UserModalProps {
  isVisible: boolean;
  editingUser: User | null;
  form: FormInstance;
  onCancel: () => void;
  onSave: (values: UserFormData) => void;
}

export default function UserModal({
  isVisible,
  editingUser,
  form,
  onCancel,
  onSave,
}: UserModalProps) {
  return (
    <Modal
      title={editingUser ? "Editar Usuário" : "Novo Usuário"}
      open={isVisible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Nome Completo"
              rules={[
                { required: true, message: "Nome é obrigatório" },
                {
                  min: 2,
                  message: "Nome deve ter pelo menos 2 caracteres",
                },
                {
                  max: 100,
                  message: "Nome deve ter no máximo 100 caracteres",
                },
              ]}
            >
              <Input placeholder="Nome completo" size="large" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email é obrigatório" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input placeholder="email@exemplo.com" size="large" />
            </Form.Item>
          </Col>
        </Row>

        {!editingUser && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="password"
                label="Senha"
                rules={[
                  { required: true, message: "Senha é obrigatória" },
                  {
                    min: 6,
                    message: "Senha deve ter pelo menos 6 caracteres",
                  },
                  {
                    max: 100,
                    message: "Senha deve ter no máximo 100 caracteres",
                  },
                ]}
              >
                <Input.Password placeholder="Digite a senha" size="large" />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="role"
              label="Função"
              rules={[{ required: true, message: "Função é obrigatória" }]}
            >
              <Select placeholder="Selecione a função" size="large">
                <Option value="ADMIN">Admin</Option>
                <Option value="SUPER_ADMIN">Super Admin</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="isActive"
              label="Usuário Ativo"
              valuePropName="checked"
            >
              <Switch defaultChecked />
            </Form.Item>
          </Col>
        </Row>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onCancel} size="large">
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" size="large">
            {editingUser ? "Atualizar" : "Criar"} Usuário
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

export { userSchema, updateUserSchema };
