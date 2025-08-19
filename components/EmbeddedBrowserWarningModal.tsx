"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

function isEmbeddedBrowser() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Instagram/i.test(ua) ||
    /FBAN|FBAV|FB_IAB|FBAN/i.test(ua) ||
    /FB/i.test(ua) ||
    /Line/i.test(ua) ||
    /LinkedInApp/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /TikTok/i.test(ua)
  );
}

export default function EmbeddedBrowserWarningModal() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isEmbeddedBrowser()) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback simples
      const textarea = document.createElement("textarea");
      textarea.value = currentUrl;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => setShow(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navegador não suportado"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 420,
          width: "100%",
          padding: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={handleClose}
          aria-label="Fechar aviso"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#f3f4f6",
            border: "none",
            borderRadius: 8,
            fontSize: 18,
            fontWeight: 700,
            color: "#888",
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
        <div style={{ marginBottom: 16 }}>
          <Image
            src="/logo.png"
            alt="Logo Remir"
            width={80}
            height={80}
            style={{ borderRadius: 12, margin: "0 auto" }}
          />
        </div>
        <h2
          style={{
            color: "#d97706",
            fontWeight: 800,
            fontSize: 20,
            marginBottom: 10,
          }}
        >
          Navegador não suportado
        </h2>
        <p style={{ color: "#222", fontSize: 15, marginBottom: 16 }}>
          Você está usando o navegador embutido de um aplicativo (Instagram,
          Facebook, etc).
          <br />
          Para garantir o funcionamento correto, abra este site no navegador
          padrão do seu celular (Safari, Chrome, etc).
        </p>
        {/* GIF de instrução para iOS e Android */}
        <div style={{ marginBottom: 18 }}>
          <Image
            src={
              /iPhone|iPad|iPod/i.test(navigator.userAgent)
                ? "/suport/ios.gif"
                : "/suport/android.gif"
            }
            alt="Como abrir no navegador externo"
            width={300}
            height={220}
            style={{
              borderRadius: 10,
              margin: "0 auto",
              maxWidth: "100%",
              height: "auto",
            }}
          />
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: "#1d4ed8",
            color: "#fff",
            fontWeight: 700,
            fontSize: 16,
            border: "none",
            borderRadius: 10,
            padding: "14px 16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            cursor: "pointer",
            marginBottom: 10,
            width: "100%",
          }}
          aria-label="Copiar link"
        >
          {copied ? "Link copiado!" : "Copiar link do site"}
        </button>
      </div>
    </div>
  );
}
