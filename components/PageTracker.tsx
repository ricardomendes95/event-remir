"use client";

import { usePageTracking } from "@/hooks/usePageTracking";

export function PageTracker() {
  usePageTracking({
    enabled: true,
    enableGeolocation: true,
  });

  // Este componente não renderiza nada visualmente
  return null;
}
