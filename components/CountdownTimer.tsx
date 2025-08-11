"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: string;
  label?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({
  targetDate,
  label = "Encerramento das inscrições",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false); // Menos de 24 horas

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsExpired(false);
        setIsUrgent(days === 0 && hours < 24); // Menos de 24 horas
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
        setIsUrgent(false);
      }
    };

    // Calcular imediatamente
    calculateTimeLeft();

    // Atualizar a cada segundo
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (isExpired) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-red-700">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Inscrições Encerradas</span>
        </div>
        <p className="text-sm text-red-600 mt-1">
          O prazo para inscrições deste evento expirou.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-lg p-4 ${
        isUrgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
      }`}
    >
      <div
        className={`flex items-center space-x-2 mb-3 ${
          isUrgent ? "text-red-700" : "text-amber-700"
        }`}
      >
        <Clock className="h-5 w-5" />
        <span className="font-medium">{label}</span>
        {isUrgent && (
          <span className="text-xs font-bold uppercase">URGENTE!</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        <div className="text-center">
          <div
            className={`bg-white rounded-lg p-1.5 sm:p-2 border ${
              isUrgent ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div
              className={`text-lg sm:text-2xl font-bold ${
                isUrgent ? "text-red-800" : "text-amber-800"
              }`}
            >
              {timeLeft.days.toString().padStart(2, "0")}
            </div>
            <div
              className={`text-xs uppercase font-medium ${
                isUrgent ? "text-red-600" : "text-amber-600"
              }`}
            >
              {timeLeft.days === 1 ? "Dia" : "Dias"}
            </div>
          </div>
        </div>

        <div className="text-center">
          <div
            className={`bg-white rounded-lg p-1.5 sm:p-2 border ${
              isUrgent ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div
              className={`text-lg sm:text-2xl font-bold ${
                isUrgent ? "text-red-800" : "text-amber-800"
              }`}
            >
              {timeLeft.hours.toString().padStart(2, "0")}
            </div>
            <div
              className={`text-xs uppercase font-medium ${
                isUrgent ? "text-red-600" : "text-amber-600"
              }`}
            >
              Horas
            </div>
          </div>
        </div>

        <div className="text-center">
          <div
            className={`bg-white rounded-lg p-1.5 sm:p-2 border ${
              isUrgent ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div
              className={`text-lg sm:text-2xl font-bold ${
                isUrgent ? "text-red-800" : "text-amber-800"
              }`}
            >
              {timeLeft.minutes.toString().padStart(2, "0")}
            </div>
            <div
              className={`text-xs uppercase font-medium ${
                isUrgent ? "text-red-600" : "text-amber-600"
              }`}
            >
              Min
            </div>
          </div>
        </div>

        <div className="text-center">
          <div
            className={`bg-white rounded-lg p-1.5 sm:p-2 border ${
              isUrgent ? "border-red-200" : "border-amber-200"
            }`}
          >
            <div
              className={`text-lg sm:text-2xl font-bold ${
                isUrgent ? "text-red-800" : "text-amber-800"
              }`}
            >
              {timeLeft.seconds.toString().padStart(2, "0")}
            </div>
            <div
              className={`text-xs uppercase font-medium ${
                isUrgent ? "text-red-600" : "text-amber-600"
              }`}
            >
              Seg
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <p
          className={`text-xs ${isUrgent ? "text-red-600" : "text-amber-600"}`}
        >
          {isUrgent ? "⚠️ Últimas horas! " : ""}
          Restam apenas{" "}
          {timeLeft.days > 0 && (
            <>
              <span className="font-semibold">{timeLeft.days}</span>{" "}
              {timeLeft.days === 1 ? "dia" : "dias"}
              {(timeLeft.hours > 0 || timeLeft.minutes > 0) && ", "}
            </>
          )}
          {timeLeft.hours > 0 && (
            <>
              <span className="font-semibold">{timeLeft.hours}</span>{" "}
              {timeLeft.hours === 1 ? "hora" : "horas"}
              {timeLeft.minutes > 0 && " e "}
            </>
          )}
          {timeLeft.minutes > 0 && timeLeft.days === 0 && (
            <>
              <span className="font-semibold">{timeLeft.minutes}</span>{" "}
              {timeLeft.minutes === 1 ? "minuto" : "minutos"}
            </>
          )}{" "}
          para se inscrever! {isUrgent ? "⏰" : ""}
        </p>
      </div>
    </div>
  );
}
