import { useEffect, useState } from "react";

/**
 * Hook para detectar teclado virtual ativo em mobile
 * Ajuda a ajustar UI quando teclado aparece/desaparece
 */
export function useVirtualKeyboard() {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  useEffect(() => {
    // Só executar no cliente
    if (typeof window === "undefined") return;

    const initialViewportHeight =
      window.visualViewport?.height || window.innerHeight;
    let timeoutId: NodeJS.Timeout;

    const handleViewportChange = () => {
      // Limpar timeout anterior
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce para evitar múltiplas chamadas
      timeoutId = setTimeout(() => {
        const currentHeight =
          window.visualViewport?.height || window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;

        // Considerar teclado ativo se a diferença for > 150px (threshold)
        const keyboardActive = heightDifference > 150;

        setIsKeyboardActive(keyboardActive);
      }, 100);
    };

    // Listeners para diferentes navegadores
    if (window.visualViewport) {
      // API moderna (Safari iOS 13+, Chrome Android)
      window.visualViewport.addEventListener("resize", handleViewportChange);
    } else {
      // Fallback para navegadores mais antigos
      window.addEventListener("resize", handleViewportChange);
    }

    // Listener para focus/blur de inputs (adicional)
    const handleInputFocus = () => {
      setTimeout(() => setIsKeyboardActive(true), 300);
    };

    const handleInputBlur = () => {
      setTimeout(() => setIsKeyboardActive(false), 100);
    };

    // Adicionar listeners em todos os inputs
    document.addEventListener("focusin", handleInputFocus);
    document.addEventListener("focusout", handleInputBlur);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          handleViewportChange
        );
      } else {
        window.removeEventListener("resize", handleViewportChange);
      }

      document.removeEventListener("focusin", handleInputFocus);
      document.removeEventListener("focusout", handleInputBlur);
    };
  }, []);

  return { isKeyboardActive };
}
