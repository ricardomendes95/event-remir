import { Button } from "@/components/ui/Button";
import { Card } from "../Card";
import { Container } from "../Container";
import { Heart, Users, BookOpen } from "lucide-react";

// Ministries Section
export const MinistriesSection = () => {
  const ministries = [
    {
      title: "Louvor e Adoração",
      description:
        "Celebramos a Deus através da música, criando um ambiente de adoração que toca corações.",
      icon: Heart,
      image: "/louvor.jpg",
    },
    {
      title: "Ministério Infantil",
      description:
        "Cuidando e ensinando nossas crianças os caminhos do Senhor de forma lúdica e amorosa.",
      icon: Users,
      image: "/dp-infantil.jpg",
    },
    {
      title: "Ministério Jovens",
      description:
        "Capacitando a nova geração para viver com propósito e impactar sua geração.",
      icon: BookOpen,
      image: "/jovens.jpg",
    },
    {
      title: "Café com Bíblia",
      description:
        "Aprofundando o conhecimento da Palavra de Deus através de estudos sistemáticos.",
      icon: BookOpen,
      image: "/cafe.jpg",
    },
  ];

  return (
    <section id="ministries" className="py-20 bg-gray-50">
      <Container>
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Nossos Ministérios
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Descubra como você pode servir e crescer espiritualmente através dos
            nossos diversos ministérios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {ministries.map((ministry, index) => (
            <Card
              key={index}
              title={ministry.title}
              description={ministry.description}
              icon={ministry.icon}
              image={ministry.image}
              className="hover:scale-105 cursor-pointer"
            />
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="primary" size="lg">
            Conheça Todos os Ministérios
          </Button>
        </div>
      </Container>
    </section>
  );
};
