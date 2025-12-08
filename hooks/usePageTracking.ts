"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

interface TrackingOptions {
  enabled?: boolean;
  enableGeolocation?: boolean;
}

export function usePageTracking(options: TrackingOptions = {}) {
  const { enabled = true, enableGeolocation = true } = options;
  const pathname = usePathname();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const hasTrackedCurrentPage = useRef<string | null>(null);

  // Gera ou recupera o sessionId
  useEffect(() => {
    if (typeof window === "undefined") return;

    let id = localStorage.getItem("analytics_session_id");
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem("analytics_session_id", id);
    }
    setSessionId(id);
  }, []);

  // Tenta obter a geolocalização
  useEffect(() => {
    if (
      !enableGeolocation ||
      typeof window === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Tenta fazer geocoding reverso usando API pública (opcional)
          // Você pode usar uma API de geocoding como OpenCage, Google, etc.
          // Por enquanto, vamos apenas salvar lat/long
          setLocation({
            latitude,
            longitude,
          });
        } catch (error) {
          console.error("Error getting location details:", error);
          setLocation({
            latitude,
            longitude,
          });
        }
      },
      (error) => {
        // Silenciosamente falha se o usuário negar permissão
        if (process.env.NODE_ENV === "development") {
          console.log("Geolocation permission denied or unavailable:", error);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 600000, // Cache por 10 minutos
      }
    );
  }, [enableGeolocation]);

  // Rastreia mudanças de página
  useEffect(() => {
    if (!enabled || !sessionId || typeof window === "undefined") {
      return;
    }

    // Evita rastrear a mesma página duas vezes seguidas
    if (hasTrackedCurrentPage.current === pathname) {
      return;
    }

    hasTrackedCurrentPage.current = pathname;

    const trackPageView = async () => {
      try {
        const referrer = document.referrer || undefined;
        const page = window.location.href;

        const data: any = {
          page,
          referrer,
          sessionId,
        };

        // Adiciona localização se disponível
        if (location) {
          data.latitude = location.latitude;
          data.longitude = location.longitude;
          if (location.city) data.city = location.city;
          if (location.country) data.country = location.country;
        }

        // Envia para a API
        await fetch("/api/analytics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
          // Não espera pela resposta para não atrasar a navegação
        }).catch((error) => {
          // Silenciosamente falha para não afetar a experiência do usuário
          if (process.env.NODE_ENV === "development") {
            console.error("Error tracking page view:", error);
          }
        });
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Error tracking page view:", error);
        }
      }
    };

    trackPageView();
  }, [pathname, sessionId, location, enabled]);

  return {
    sessionId,
    location,
    isTracking: enabled && !!sessionId,
  };
}
