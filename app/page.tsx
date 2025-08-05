import { Suspense } from "react";
import { EventDisplay } from "@/components/EventDisplay";
import { SearchComprovante } from "@/components/SearchComprovante";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Event Remir</h1>
            <nav className="hidden md:flex space-x-6">
              <a href="#evento" className="text-gray-600 hover:text-gray-900">
                Evento
              </a>
              <a
                href="#comprovante"
                className="text-gray-600 hover:text-gray-900"
              >
                Meu Comprovante
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section - Event Display */}
        <section id="evento" className="py-12 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              }
            >
              <EventDisplay />
            </Suspense>
          </div>
        </section>

        {/* Search Comprovante Section */}
        <section id="comprovante" className="py-16 bg-gray-50">
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
    </div>
  );
}
