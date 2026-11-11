"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PageTracker } from "@/components/PageTracker";
import {
  CONSENT_OPEN_EVENT,
  getConsent,
  saveConsent,
  type ConsentChoice,
} from "@/lib/consent";

export function PrivacyConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const stored = getConsent();
    setChoice(stored);
    setShowBanner(stored === null);

    const reopen = () => setShowBanner(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  const decide = (value: ConsentChoice) => {
    saveConsent(value);
    setChoice(value);
    setShowBanner(false);
  };

  return (
    <>
      {choice === "accepted" && <PageTracker />}

      {showBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Privacidade e uso de dados"
          className="fixed inset-x-0 bottom-0 z-[1000] p-4"
        >
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-gray-200 md:flex md:items-center md:gap-6">
            <p className="text-sm leading-relaxed text-gray-700">
              Usamos dados de navegação e, se você permitir no navegador, a sua
              localização aproximada para entender como o site é usado e
              melhorar nossos eventos, conforme a LGPD. Você pode mudar sua
              escolha quando quiser. Saiba mais na nossa{" "}
              <Link
                href="/privacidade"
                className="font-medium text-[#015C91] underline"
              >
                Política de Privacidade
              </Link>
              .
            </p>
            <div className="mt-4 flex shrink-0 gap-3 md:mt-0">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 md:flex-none"
                onClick={() => decide("declined")}
              >
                Recusar
              </Button>
              <Button
                size="sm"
                className="flex-1 md:flex-none"
                onClick={() => decide("accepted")}
              >
                Aceitar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
