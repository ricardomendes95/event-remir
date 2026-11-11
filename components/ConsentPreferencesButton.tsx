"use client";

import { openConsentPreferences } from "@/lib/consent";

export function ConsentPreferencesButton({
  className = "",
  children = "Preferências de privacidade",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={openConsentPreferences}
      className={`cursor-pointer underline ${className}`}
    >
      {children}
    </button>
  );
}
