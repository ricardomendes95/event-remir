import { useEffect } from "react";

/**
 * Hook para scroll automático para input ativo quando teclado virtual aparece
 * Útil em dispositivos mobile
 */
export function useAutoScrollToActiveInput() {
  useEffect(() => {
    // Só executar no cliente
    if (typeof window === "undefined") return;

    let timeoutId: NodeJS.Timeout;

    const handleInputFocus = (event: FocusEvent) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;

      // Verificar se é um input/textarea
      if (
        !target ||
        (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")
      ) {
        return;
      }

      // Aguardar um pouco para o teclado aparecer
      timeoutId = setTimeout(() => {
        // Verificar se o elemento ainda está em foco
        if (document.activeElement === target) {
          // Calcular posição ideal (1/3 da tela)
          const viewportHeight =
            window.visualViewport?.height || window.innerHeight;
          const targetRect = target.getBoundingClientRect();
          const idealPosition = viewportHeight / 3;

          // Se o input não estiver na posição ideal, fazer scroll
          if (
            targetRect.top > idealPosition ||
            targetRect.bottom > viewportHeight * 0.7
          ) {
            target.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }
      }, 300); // Delay para aguardar teclado virtual aparecer
    };

    // Listener global para focus em inputs
    document.addEventListener("focusin", handleInputFocus, true);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      document.removeEventListener("focusin", handleInputFocus, true);
    };
  }, []);
}
