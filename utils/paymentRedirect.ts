/**
 * 🚨 Etapa 4 - Fix Redirecionamento Pagamento
 * Utilitário para redirecionamento robusto que funciona em PWAs e browsers embebidos
 */

import { useState, useCallback } from "react";

export interface RedirectResult {
  success: boolean;
  fallbackNeeded: boolean;
  method: "location" | "window.open" | "failed";
  userAgent: string;
}

/**
 * Detecta se está em um ambiente embebido (Instagram, Facebook, etc.)
 */
export function detectEmbeddedEnvironment() {
  if (typeof window === "undefined")
    return {
      isEmbedded: false,
      browser: "unknown",
      userAgent: "server-side",
    };

  const userAgent = navigator.userAgent || "unknown";

  return {
    isEmbedded: window !== window.top,
    isInstagram: /Instagram/.test(userAgent),
    isFacebook:
      /FB/.test(userAgent) || /FBAN/.test(userAgent) || /FBAV/.test(userAgent),
    isTwitter: /Twitter/.test(userAgent),
    isLinkedIn: /LinkedInApp/.test(userAgent),
    isTikTok: /TikTok/.test(userAgent),
    isWebView: /wv/.test(userAgent),
    isPWA: window.matchMedia("(display-mode: standalone)").matches,
    userAgent,
  };
}

/**
 * Redireciona para pagamento de forma robusta
 */
export function redirectToPayment(url: string): RedirectResult {
  if (typeof window === "undefined") {
    return {
      success: false,
      fallbackNeeded: true,
      method: "failed",
      userAgent: "server-side",
    };
  }

  const env = detectEmbeddedEnvironment();

  try {
    // 🚨 PRIORIDADE 1: Browsers embebidos (Instagram, Facebook, etc.)
    if (
      env.isEmbedded ||
      env.isInstagram ||
      env.isFacebook ||
      env.isTwitter ||
      env.isLinkedIn
    ) {
      console.log("🔄 Ambiente embebido detectado, usando window.open");

      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      // Verificar se o popup foi bloqueado
      if (!newWindow || newWindow.closed) {
        console.warn("⚠️ Popup bloqueado, precisará de fallback manual");
        return {
          success: false,
          fallbackNeeded: true,
          method: "window.open",
          userAgent: env.userAgent,
        };
      }

      return {
        success: true,
        fallbackNeeded: false,
        method: "window.open",
        userAgent: env.userAgent,
      };
    }

    // 🚨 PRIORIDADE 2: PWAs
    if (env.isPWA) {
      console.log("📱 PWA detectado, usando window.open");

      const newWindow = window.open(url, "_blank");

      return {
        success: !!newWindow,
        fallbackNeeded: !newWindow,
        method: "window.open",
        userAgent: env.userAgent,
      };
    }

    // 🚨 PRIORIDADE 3: WebViews (apps nativos)
    if (env.isWebView) {
      console.log("📱 WebView detectado, tentando window.open primeiro");

      const newWindow = window.open(url, "_blank");

      if (!newWindow) {
        console.log("⚡ window.open falhou, usando location.href");
        window.location.href = url;
        return {
          success: true,
          fallbackNeeded: false,
          method: "location",
          userAgent: env.userAgent,
        };
      }

      return {
        success: true,
        fallbackNeeded: false,
        method: "window.open",
        userAgent: env.userAgent,
      };
    }

    // 🚨 PRIORIDADE 4: Navegadores normais
    console.log("🌐 Navegador normal, usando location.href");
    window.location.href = url;

    return {
      success: true,
      fallbackNeeded: false,
      method: "location",
      userAgent: env.userAgent,
    };
  } catch (error) {
    console.error("❌ Erro no redirecionamento:", error);

    return {
      success: false,
      fallbackNeeded: true,
      method: "failed",
      userAgent: env.userAgent,
    };
  }
}

/**
 * Hook React para redirecionamento com feedback visual
 */
export function usePaymentRedirect() {
  const [redirecting, setRedirecting] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<RedirectResult | null>(null);

  const performRedirect = useCallback(
    async (url: string): Promise<RedirectResult> => {
      setRedirecting(true);

      // Delay pequeno para mostrar loading
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = redirectToPayment(url);
      setLastAttempt(result);
      setRedirecting(false);

      return result;
    },
    []
  );

  return {
    redirectToPayment: performRedirect,
    redirecting,
    lastAttempt,
  };
}

// Para compatibilidade, manter importação direta disponível
export { redirectToPayment as default };
