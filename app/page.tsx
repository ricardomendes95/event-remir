"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EventDisplay } from "@/components/event/EventDisplay";
import { SearchComprovante } from "@/components/SearchComprovante";
import { AutoShowProofModal } from "@/components/AutoShowProofModal";
import { useSectionRefs } from "@/contexts/SectionRefsContext";
import { Button } from "antd";
import { UserCheck, CreditCard, ArrowUp } from "lucide-react";

function HomePageContent() {
  const searchParams = useSearchParams();
  const { refs, scrollToSection } = useSectionRefs();
  const { eventoRef, comprovanteRef } = refs;
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [urlCpf, setUrlCpf] = useState<string>("");

  useEffect(() => {
    const cpfParam = searchParams?.get("cpf");
    if (cpfParam) {
      setUrlCpf(cpfParam);
      // Scroll para a seção do evento
      setTimeout(() => {
        scrollToSection(eventoRef);
      }, 100);
    }
  }, [searchParams, scrollToSection, eventoRef]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      // Mostra o botão flutuante após rolar 300px
      setShowFloatingButton(scrollTop > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleInscricaoClick = () => {
    // Feedback visual suave
    if (navigator.vibrate) {
      navigator.vibrate(50); // Vibração sutil de 50ms
    }

    // Scroll para a seção do evento
    scrollToSection(eventoRef);

    // Aguarda o scroll terminar e então clica no botão de inscrição
    setTimeout(() => {
      const inscricaoButton = document.querySelector(
        '[data-testid="inscricao-button"]'
      ) as HTMLButtonElement;
      if (inscricaoButton && !inscricaoButton.disabled) {
        inscricaoButton.click();
      }
    }, 800);
  };

  const handleComprovanteClick = () => {
    if (navigator.vibrate) {
      navigator.vibrate(30); // Vibração mais suave para ação secundária
    }
    scrollToSection(comprovanteRef);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}

      {/* Main Content */}
      <main>
        {/* Hero Section - Event Display */}
        <section ref={eventoRef} id="evento" className="py-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              }
            >
              <EventDisplay initialCpf={urlCpf} />
            </Suspense>
          </div>
        </section>

        {/* Search Comprovante Section */}
        <section
          ref={comprovanteRef}
          id="comprovante"
          className="py-16 bg-gray-50"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Consultar Comprovante
              </h2>
              <p className="text-lg text-gray-600">
                Digite seu CPF ou email para consultar sua inscrição
              </p>
            </div>
            <div className="flex justify-center">
              <SearchComprovante />
            </div>
          </div>
        </section>
      </main>

      {/* Floating Action Button - Mobile Only */}
      {showFloatingButton && (
        <div className="fixed bottom-24 right-4 z-40 md:hidden">
          <div className="flex flex-col space-y-3">
            <Button
              shape="circle"
              size="large"
              icon={<CreditCard size={18} />}
              onClick={handleComprovanteClick}
              className="shadow-xl bg-white hover:bg-gray-50 w-14 h-14 flex items-center justify-center border-2 border-gray-100"
              title="Meu Comprovante"
            />
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<UserCheck size={18} />}
              onClick={handleInscricaoClick}
              className="shadow-xl w-14 h-14 flex items-center justify-center animate-pulse"
              title="Inscreva-se"
            />
          </div>
        </div>
      )}

      {/* Back to top button */}
      {showFloatingButton && (
        <div className="fixed bottom-6 right-4 z-30">
          <Button
            shape="circle"
            size="middle"
            icon={<ArrowUp size={16} />}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="shadow-lg bg-gray-800 hover:bg-gray-700 text-white border-gray-800 hover:border-gray-700 w-10 h-10 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
            title="Voltar ao topo"
          />
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-400">
              © 2025 Igreja Remir. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Auto Show Proof Modal */}
      <AutoShowProofModal />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
