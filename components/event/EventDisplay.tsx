"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Button } from "antd";
import EventRegistrationModal from "./EventRegistrationModal";
import { Event } from "@/types/event";
import { formatTextToHtml } from "../../utils/textFormatter";
import { CountdownTimer } from "../CountdownTimer";

export function EventDisplay() {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const response = await fetch("/api/events/active");
        if (response.ok) {
          const eventData = await response.json();
          setEvent(eventData);
        }
      } catch (error) {
        console.error("Erro ao buscar evento:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEvent();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <CalendarDays className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Nenhum Evento Disponível
            </h1>
            <p className="text-gray-600">
              No momento não há eventos abertos para inscrição. Fique atento às
              nossas redes sociais para saber quando abrirão novas inscrições!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Verificar se as inscrições ainda estão abertas
  const isRegistrationOpen = () => {
    if (!event.registrationEndDate) return true;
    return new Date() < new Date(event.registrationEndDate);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Banner da Imagem */}
        {event.bannerUrl && (
          <div className="aspect-video w-full relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.bannerUrl}
              alt={`Banner do evento ${event.name}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>
        )}

        {/* Conteúdo do Evento */}
        <div className="p-6 lg:p-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Informações Principais */}
            <div className="lg:col-span-2">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                {event.name}
              </h1>

              {event.description && (
                <div className="event-description mb-6">
                  <div
                    className="formatted-content"
                    dangerouslySetInnerHTML={{
                      __html: formatTextToHtml(event.description),
                    }}
                  />
                </div>
              )}

              {/* Detalhes do Evento */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Data</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {formatDate(event.eventDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Horário</p>
                    <p className="text-sm text-gray-600">
                      {formatTime(event.eventDate)}
                    </p>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Local</p>
                      <p className="text-sm text-gray-600">{event.location}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Vagas</p>
                    <p className="text-sm text-gray-600">
                      {event.capacity - event.currentRegistrations} disponíveis
                      de {event.capacity}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Inscrição */}
            <div className="lg:col-span-1">
              <div className="bg-gray-50 rounded-xl p-6 sticky top-6">
                {/* Contagem Regressiva */}
                {event.registrationEndDate && isRegistrationOpen() && (
                  <div className="mb-6">
                    <CountdownTimer
                      targetDate={event.registrationEndDate}
                      label="Encerramento das inscrições"
                    />
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {event.price.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">por pessoa</p>
                </div>

                <Button
                  type="primary"
                  size="large"
                  className="w-full h-12 text-lg font-semibold"
                  onClick={() => setModalOpen(true)}
                  disabled={
                    event.currentRegistrations >= event.capacity ||
                    !isRegistrationOpen()
                  }
                  data-testid="inscricao-button"
                >
                  {event.currentRegistrations >= event.capacity
                    ? "Esgotado"
                    : !isRegistrationOpen()
                    ? "Inscrições Encerradas"
                    : "Quero me inscrever"}
                </Button>

                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    Pagamento 100% seguro via Mercado Pago
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Inscrição */}
      <EventRegistrationModal
        event={event}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
