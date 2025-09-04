import { Button } from "@/components/ui/Button";
import { Youtube, BookOpen, Calendar } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Container } from "../Container";

type Verse = {
  translation: {
    identifier: string;
    name: string;
    language: string;
    language_code: string;
    license: string;
  };
  random_verse: {
    book_id: string;
    book: string;
    chapter: number;
    verse: number;
    text: string;
  };
};
// Hero Section
export const HeroSection = () => {
  const [verse, setVerse] = useState<Verse | null>(null);

  useEffect(() => {
    fetch("https://bible-api.com/data/almeida/random/NT")
      .then((res) => res.json())
      .then((data) => setVerse(data));
  }, []);

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center bg-gradient-to-br from-blue-50 via-white to-blue-100 mt-16 lg:mt-20"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-300 rounded-full">
          <Image
            src="/left.jpg"
            alt="Cross"
            layout="fill"
            className="rounded-full"
          />
        </div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-blue-200 rounded-full">
          <Image
            src="/right.jpg"
            alt="Cross"
            layout="fill"
            className="rounded-full"
          />
        </div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-100 rounded-full">
          <Image
            src="/fachada.jpg"
            alt="Cross"
            layout="fill"
            className="rounded-full"
          />
        </div>
      </div>

      <Container className="pt-20 lg:pt-0 z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-800 mb-6 leading-tight">
              Bem-vindo à
              <span className="block text-[#015C91]">Igreja Remir</span>
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-8 leading-relaxed">
              Um lugar onde vidas são renovadas e corações encontram paz. Venha
              fazer parte da nossa família de fé.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <a
                href="https://www.youtube.com/@ministerioremir3524"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none"
              >
                <Button variant="primary" size="lg" className="w-full">
                  <Youtube className="mr-2" size={25} />
                  Conheça Nosso Canal
                </Button>
              </a>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 sm:flex-none"
              >
                <Calendar className="mr-2" size={20} />
                Participe dos Cultos
              </Button>
            </div>

            {/* Service Times */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Horários dos Cultos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-[#015C91]">Domingo</p>
                  <p className="text-gray-700">Consagração às 15h</p>
                  <p className="text-gray-700">Domingo Profético às 17h</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-[#015C91]">Quarta-feira</p>
                  <p className="text-gray-700">Consagração às 13h</p>
                  <p className="text-gray-700">Círculo de Oração às 14h</p>
                  <p className="text-gray-700">Café com Bíblia às 20h</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image/Illustration */}
          <div className="relative">
            <div className="bg-gradient-to-br from-[#88CDF6] to-[#015C91] rounded-2xl p-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="bg-white rounded-xl p-6 transform -rotate-3">
                <div className="text-center">
                  <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
                    <BookOpen className="text-[#015C91]" size={48} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    Palavra de Vida
                  </h3>
                  {verse ? (
                    <p className="text-gray-600 italic mb-4">
                      {`"${verse.random_verse.text}" - ${verse.random_verse.book} ${verse.random_verse.chapter}:${verse.random_verse.verse}`}
                    </p>
                  ) : (
                    <p className="text-gray-600">
                      {`"Porque onde estiverem dois ou três reunidos em meu nome, aí
                    estou eu no meio deles." - Mateus 18:20`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};
