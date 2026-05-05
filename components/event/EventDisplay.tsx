"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin, Users, ExternalLink } from "lucide-react";
import { Button } from "antd";
import EventRegistrationModal from "./EventRegistrationModal";
import { Event } from "@/types/event";
// formatTextToHtml removido - agora usamos HTML direto do TipTap
import { CountdownTimer } from "../CountdownTimer";
import EmbeddedBrowserWarningModal from "@/components/EmbeddedBrowserWarningModal";

interface EventDisplayProps {
  initialCpf?: string;
  slug?: string;
}

export function EventDisplay({ initialCpf, slug }: EventDisplayProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Abrir modal automaticamente se há CPF inicial
  useEffect(() => {
    if (initialCpf && event) {
      setModalOpen(true);
    }
  }, [initialCpf, event]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const url = slug
          ? `/api/events/by-slug/${slug}`
          : "/api/events/active";
        const response = await fetch(url);
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

    fetchEvent();
  }, [slug]);

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
      {!event.isFree && <EmbeddedBrowserWarningModal />}
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
                    className="formatted-content prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: event.description,
                    }}
                  />
                </div>
              )}

              {/* Detalhes do Evento */}
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <CalendarDays className="text-blue-600" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Data</p>
                    <p className="text-sm text-gray-600 capitalize">
                      {formatDate(event.eventDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="text-blue-600" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Horário</p>
                    <p className="text-sm text-gray-600">
                      {formatTime(event.eventDate)}
                    </p>
                  </div>
                </div>

                {event.location && (
                  <div className="space-y-2">
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                      width="100%"
                      height="200"
                      style={{ border: 0, borderRadius: 8 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Localização do evento"
                    />
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    >
                      <MapPin size={16} className="shrink-0" />
                      <span className="text-sm">{event.location}</span>
                      <ExternalLink size={13} className="shrink-0" />
                    </a>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Users className="text-blue-600" size={20} />
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
                    {event.isFree ? (
                      <span className="text-3xl font-bold text-green-600">
                        Gratuito
                      </span>
                    ) : (
                      <span className="text-3xl font-bold text-gray-900">
                        {event.price.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    )}
                  </div>
                  {!event.isFree && (
                    <p className="text-sm text-gray-600">por pessoa</p>
                  )}
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
        initialCpf={initialCpf}
      />
    </>
  );
}
