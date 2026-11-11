import type { Metadata } from "next";
import { Container } from "@/components/home/Container";
import { LivesContent } from "@/components/lives/LivesContent";

export const metadata: Metadata = {
  title: "Transmissões ao vivo | Igreja Remir Caruaru",
  description:
    "Acompanhe os cultos e eventos da Igreja Remir Caruaru ao vivo, veja as próximas transmissões e reveja as anteriores.",
};

export default function LivesPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-12 pt-24 md:pb-16 md:pt-28">
      <Container>
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Transmissões ao vivo
            </h1>
            <p className="text-gray-600">
              Assista aos nossos cultos e eventos com um toque.
            </p>
          </header>
          <LivesContent />
        </div>
      </Container>
    </main>
  );
}
