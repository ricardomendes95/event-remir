"use client";

import { useState } from "react";
import { Button, Card } from "antd";
import { FileText } from "lucide-react";
import { RegistrationProofModal } from "./RegistrationProofModal";

export function SearchComprovante() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Card className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Buscar Comprovante
          </h3>
          <p className="text-sm text-gray-600">
            Digite seu CPF para encontrar sua inscrição
          </p>
        </div>

        <Button
          type="primary"
          size="large"
          block
          icon={<FileText className="h-4 w-4" />}
          onClick={() => setModalOpen(true)}
        >
          Consultar Inscrição
        </Button>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">Dica:</p>
              <p>
                Use o CPF utilizado na inscrição para encontrar seu comprovante
                e imprimir se necessário.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <RegistrationProofModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
