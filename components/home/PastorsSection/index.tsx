import Image from "next/image";
import { Container } from "../Container";
import { Button } from "@/components/ui/Button";
import { Heart } from "lucide-react";

// Pastors Section
export const PastorsSection = () => {
  return (
    <section
      id="pastors"
      className="py-20 bg-gradient-to-br from-blue-50 to-white"
    >
      <Container>
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Nossos Pastores Presidentes
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Conheça os líderes que Deus colocou para pastorear e guiar nossa
            comunidade de fé.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Foto dos Pastores */}
              <div className="relative h-64 lg:h-96 rounded-br-2xls">
                <Image
                  src="/pastores-casal.JPG" // Você precisará adicionar esta imagem na pasta public
                  alt="Pastores Presidentes"
                  fill
                  className="object-cover rounded-br-2xls"
                  style={{ borderBottomRightRadius: "1.5rem" }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#015C91]/10 to-[#88CDF6]/10"></div>
              </div>

              {/* Informações dos Pastores */}
              <div className="p-8 lg:p-12">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-3xl font-bold text-[#015C91] mb-2">
                      Pastor Presidente
                    </h3>
                    <p className="text-xl text-gray-700 font-medium">
                      Pedro Andrade
                    </p>
                  </div>

                  <div>
                    <h4 className="text-2xl font-bold text-[#015C91] mb-2">
                      Pastora Presidente
                    </h4>
                    <p className="text-xl text-gray-700 font-medium">
                      Andrezza Andrade
                    </p>
                  </div>

                  <div className="border-l-4 border-[#88CDF6] pl-6">
                    <p className="text-gray-600 leading-relaxed italic">
                      &ldquo;Porque onde estiverem dois ou três reunidos em meu
                      nome, aí estou eu no meio deles.&rdquo;
                    </p>
                    <p className="text-[#015C91] font-medium mt-2">
                      - Mateus 18:20
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-gray-600 leading-relaxed">
                      Com coração pastoral e visão profética, nossos pastores
                      presidentes lideram nossa igreja com amor, sabedoria e
                      dedicação ao Reino de Deus.
                    </p>

                    <p className="text-gray-600 leading-relaxed">
                      Juntos, eles pastoreiam nossa comunidade com o propósito
                      de ver vidas transformadas e famílias restauradas através
                      do poder do evangelho.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
