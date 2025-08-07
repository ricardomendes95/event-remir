"use client";

import React from "react";
import { Modal, Form, Input, Button } from "antd";
import type { FormInstance } from "antd";
import { z } from "zod";

// Schema de validação para alteração de senha
const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(6, "Nova senha deve ter pelo menos 6 caracteres")
      .max(50, "Nova senha muito longa"),
    confirmPassword: z
      .string()
      .min(6, "Confirmação de senha deve ter pelo menos 6 caracteres"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });

interface ChangePasswordData {
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordModalProps {
  isVisible: boolean;
  userName: string;
  form: FormInstance;
  loading: boolean;
  onCancel: () => void;
  onSave: (values: ChangePasswordData) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isVisible,
  userName,
  form,
  loading,
  onCancel,
  onSave,
}) => {
  return (
    <Modal
      title={`Alterar Senha - ${userName}`}
      open={isVisible}
      onCancel={onCancel}
      footer={null}
      width={400}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSave} className="mt-4">
        <Form.Item
          name="newPassword"
          label="Nova Senha"
          rules={[
            { required: true, message: "Nova senha é obrigatória" },
            {
              min: 6,
              message: "Nova senha deve ter pelo menos 6 caracteres",
            },
          ]}
        >
          <Input.Password
            placeholder="Digite a nova senha"
            size="large"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmar Nova Senha"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Confirmação de senha é obrigatória" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Senhas não conferem"));
              },
            }),
          ]}
        >
          <Input.Password
            placeholder="Confirme a nova senha"
            size="large"
            autoComplete="new-password"
          />
        </Form.Item>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onCancel} size="large" disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            danger
          >
            Alterar Senha
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export { changePasswordSchema };
