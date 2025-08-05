"use client";

import { useState } from "react";
import { Input, Button, Card } from "antd";
import { Search, FileText, Mail } from "lucide-react";

export function SearchComprovante() {
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;

    setLoading(true);
    // TODO: Implementar busca na Fase 7
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <Card className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Buscar Comprovante
        </h3>
        <p className="text-sm text-gray-600">
          Digite seu CPF ou email para encontrar sua inscrição
        </p>
      </div>

      <div className="space-y-4">
        <Input
          size="large"
          placeholder="CPF (000.000.000-00) ou email"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          prefix={
            searchValue.includes("@") ? (
              <Mail className="h-4 w-4 text-gray-400" />
            ) : (
              <FileText className="h-4 w-4 text-gray-400" />
            )
          }
        />

        <Button
          type="primary"
          size="large"
          icon={<Search className="h-4 w-4" />}
          onClick={handleSearch}
          loading={loading}
          disabled={!searchValue.trim()}
          className="w-full"
        >
          {loading ? "Buscando..." : "Buscar Comprovante"}
        </Button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Este recurso será implementado na Fase 7
        </p>
      </div>
    </Card>
  );
}
