"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RegistrationProofModal } from "./RegistrationProofModal";
import { message } from "antd";

interface RegistrationData {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  paymentId: string;
  registrationDate: string;
  event: {
    title: string;
    price: number;
    date: string;
    location: string;
  };
}

export function AutoShowProofModal() {
  const [modalOpen, setModalOpen] = useState(false);
  const [registrationData, setRegistrationData] =
    useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const handleCloseModal = () => {
    setModalOpen(false);
    setRegistrationData(null);

    // Limpar query params da URL
    const url = new URL(window.location.href);
    url.searchParams.delete("registration_id");
    url.searchParams.delete("payment_id");
    url.searchParams.delete("comprovante");

    // Atualizar URL sem os parâmetros
    router.replace(url.pathname, { scroll: false });
  };

  useEffect(() => {
    const checkForAutoShow = async () => {
      // Verificar se há parâmetros para mostrar comprovante automaticamente
      const registrationId = searchParams.get("registration_id");
      const paymentId = searchParams.get("payment_id");
      const showComprovante = searchParams.get("comprovante");

      if ((registrationId || paymentId) && showComprovante !== "false") {
        setLoading(true);

        try {
          // Buscar dados da inscrição
          const response = await fetch(`/api/registrations/get-by-id`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registrationId,
              paymentId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setRegistrationData(data);
            setModalOpen(true);
            message.success("Inscrição confirmada! Aqui está seu comprovante.");
          } else {
            console.warn(
              "Não foi possível carregar dados da inscrição automaticamente"
            );
          }
        } catch (error) {
          console.warn("Erro ao carregar comprovante automaticamente:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    checkForAutoShow();
  }, [searchParams]);

  return (
    <RegistrationProofModal
      open={modalOpen}
      onClose={handleCloseModal}
      preloadedData={registrationData}
    />
  );
}
