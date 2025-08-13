import { useState, useCallback, useRef } from "react";

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
  const [isValidatingCpf, setIsValidatingCpf] = useState(false);
  const [cpfValidationError, setCpfValidationError] = useState<string | null>(
    null
  );

  // Controle de cancelamento de requisições
  const abortControllerRef = useRef<AbortController | null>(null);

  // Referência para o timeout do debounce
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkExistingCpf = useCallback(
    async (cpf: string, retries = 2): Promise<void> => {
      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Criar novo controller para esta requisição
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setIsValidatingCpf(true);
        setCpfValidationError(null);

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
          signal: controller.signal, // Adicionar signal de abort
        });

        // Se a requisição foi cancelada, não processar resultado
        if (controller.signal.aborted) {
          return;
        }

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
      } catch (error: unknown) {
        // Não processar erros de requisições canceladas
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Erro ao verificar CPF:", error);

        // Retry logic para erros de rede
        if (
          retries > 0 &&
          error instanceof Error &&
          (error.message.includes("fetch") || error.message.includes("network"))
        ) {
          console.log(
            `Tentando novamente... (${retries} tentativas restantes)`
          );
          setTimeout(() => {
            checkExistingCpf(cpf, retries - 1);
          }, 1000); // Aguardar 1 segundo antes de tentar novamente
          return;
        }

        // Definir erro para mostrar ao usuário apenas em casos críticos
        setCpfValidationError("Erro ao verificar CPF. Tente novamente.");
      } finally {
        setIsValidatingCpf(false);
      }
    },
    []
  );

  // Função debounced para verificação de CPF
  const debouncedCpfCheck = useCallback(
    (cpf: string) => {
      // Limpar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Configurar novo timeout
      timeoutRef.current = setTimeout(() => {
        checkExistingCpf(cpf);
      }, 800);
    },
    [checkExistingCpf]
  );

  const clearCpfVerification = () => {
    // Cancelar qualquer requisição em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Cancelar timeout de debounce se existir
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setExistingRegistration(null);
    setShowExistingOptions(false);
    setIsValidatingCpf(false);
    setCpfValidationError(null);
  };

  const handleCpfChange = (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");

    // Limpar estados anteriores
    setCpfValidationError(null);

    if (cleanCpf.length === 11) {
      // CPF completo, fazer verificação com debounce
      debouncedCpfCheck(cpf);
    } else {
      // CPF incompleto, limpar verificação
      clearCpfVerification();
    }
  };

  return {
    existingRegistration,
    showExistingOptions,
    isValidatingCpf, // NOVO: estado de loading
    cpfValidationError, // NOVO: erro de validação
    handleCpfChange,
    clearCpfVerification,
  };
}
