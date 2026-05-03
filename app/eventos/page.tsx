"use client";
import { useEffect, useState, JSX } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { Event } from "@/types/event";

function EventCard({
  event,
}: {
  event: Event & { slug: string };
}): JSX.Element {
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const isRegistrationOpen = () => {
    if (!event.registrationEndDate) return true;
    return new Date() < new Date(event.registrationEndDate);
  };

  const spotsLeft = event.capacity - event.currentRegistrations;

  return (
    <Link
      href={`/eventos/${event.slug}`}
      className="block bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {event.bannerUrl && (
        <div className="aspect-video w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.bannerUrl}
            alt={`Banner ${event.name}`}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {event.name}
          </h2>
          {event.isFree ? (
            <span className="shrink-0 bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
              Gratuito
            </span>
          ) : (
            <span className="shrink-0 bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
              {event.price.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          )}
        </div>

        <div className="space-y-2 mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-blue-500 shrink-0" />
            <span className="capitalize">{formatDate(event.eventDate)}</span>
          </div>
          {event.location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
            >
              <MapPin size={15} className="shrink-0" />
              <span>{event.location}</span>
            </a>
          )}
          <div className="flex items-center gap-2">
            <Users size={15} className="text-blue-500 shrink-0" />
            <span>
              {spotsLeft > 0 ? `${spotsLeft} vagas disponíveis` : "Esgotado"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {!isRegistrationOpen() ? (
            <span className="text-xs text-gray-400">Inscrições encerradas</span>
          ) : spotsLeft <= 0 ? (
            <span className="text-xs text-red-500 font-medium">Esgotado</span>
          ) : (
            <span className="text-xs text-green-600 font-medium">
              Inscrições abertas
            </span>
          )}

          <span className="flex items-center gap-1 text-sm font-medium text-blue-600">
            Ver detalhes
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function EventsListPage(): JSX.Element {
  const [events, setEvents] = useState<(Event & { slug: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events/list-active")
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Eventos</h1>
          <p className="text-lg text-gray-600">
            Confira os eventos disponíveis e faça sua inscrição
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center py-20">
            <CalendarDays className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              Nenhum evento disponível
            </h2>
            <p className="text-gray-500">
              Fique atento às nossas redes sociais para novidades!
            </p>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
