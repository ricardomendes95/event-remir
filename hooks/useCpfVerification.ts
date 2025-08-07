import { useState } from "react";

interface ExistingRegistration {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId: string | null;
  registrationDate: string;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
}

export function useCpfVerification() {
  const [existingRegistration, setExistingRegistration] =
    useState<ExistingRegistration | null>(null);
  const [showExistingOptions, setShowExistingOptions] = useState(false);

  const checkExistingCpf = async (cpf: string) => {
    try {
      const cleanCpf = cpf.replace(/\D/g, "");

      if (cleanCpf.length !== 11) {
        return; // CPF incompleto, não verificar ainda
      }

      const response = await fetch("/api/registrations/search-by-cpf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cpf: cleanCpf }),
      });

      if (response.status === 404) {
        // CPF não encontrado, pode continuar
        setExistingRegistration(null);
        setShowExistingOptions(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Erro ao verificar CPF");
      }

      const data = await response.json();
      setExistingRegistration(data);
      setShowExistingOptions(true);
    } catch (error) {
      console.error("Erro ao verificar CPF:", error);
      // Não mostrar erro para o usuário, apenas continuar
    }
  };

  const clearCpfVerification = () => {
    setExistingRegistration(null);
    setShowExistingOptions(false);
  };

  const handleCpfChange = (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length === 11) {
      checkExistingCpf(cpf);
    } else {
      clearCpfVerification();
    }
  };

  return {
    existingRegistration,
    showExistingOptions,
    handleCpfChange,
    clearCpfVerification,
  };
}
