import { Event } from "@/types/event";

interface EventSummaryProps {
  event: Event;
}

export function EventSummary({ event }: EventSummaryProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-gray-900 mb-2">Resumo da Inscrição</h3>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600">Evento: {event.name}</p>
          <p className="text-sm text-gray-600">
            Data: {new Date(event.eventDate).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">
            {event.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
