import { Button } from "@/components/ui/Button";
import { Container } from "../Container";
import { BookOpen, Calendar, Heart, Users } from "lucide-react";

// About Section
export const AboutSection = () => {
  function getYearsSinceJune2017(): number {
    const start = new Date(2017, 5, 1); // June is month 5 (0-based)
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    // If current month/day is before June, subtract one year
    if (now.getMonth() < 5 || (now.getMonth() === 5 && now.getDate() < 1)) {
      years--;
    }
    return years;
  }
  return (
    <section id="about" className="py-20 bg-white">
      <Container>
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Sobre a Igreja Remir
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Remir significa: libertar; fazer com que algo, alguém, se torne
            livre. Somos um ministério missionário fundamentado na doutrina dos
            Apóstolos, cujo foco é viver o propósito da Igreja e estabelecer o
            Reino do Senhor. Vivemos fundamentados em quatro pilares,
            Conhecimento, Serviço, Relacionamento e Adoração, desenvolvendo
            missões sustentáveis, transculturais, urbanas e ações sociais
            buscando transformar a sociedade através do sacerdócio dos filhos de
            Deus.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          <div>
            <h3 className="text-3xl font-bold text-gray-800 mb-6">
              Nossa História
            </h3>
            <p className="text-gray-600 leading-relaxed mb-6">
              Fundada em 2017, a Igreja Remir nasceu do sonho de criar um espaço
              onde pessoas de todas as idades e backgrounds pudessem encontrar
              esperança, propósito e uma família espiritual acolhedora.
            </p>
            <p className="text-gray-600 leading-relaxed mb-6">
              Ao longo dos anos, temos sido testemunhas de inúmeras
              transformações de vidas, famílias restauradas e uma comunidade que
              cresce em amor e fé a cada dia.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline">Nossa Missão</Button>
              <Button variant="outline">Nossa Visão</Button>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl p-8 shadow-xl">
              <div className="bg-white rounded-xl p-6 text-center">
                <Users className="text-yellow-600 mx-auto mb-4" size={48} />
                <h4 className="text-2xl font-bold text-gray-800 mb-2">500+</h4>
                <p className="text-gray-600">Vidas transformadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full p-4 w-fit mx-auto mb-4">
              <Users className="text-[#015C91]" size={32} />
            </div>
            <h4 className="text-3xl font-bold text-gray-800 mb-2">60+</h4>
            <p className="text-gray-600">Membros Ativos</p>
          </div>
          <div className="text-center">
            <div className="bg-yellow-100 rounded-full p-4 w-fit mx-auto mb-4">
              <Calendar className="text-yellow-600" size={32} />
            </div>
            <h4 className="text-3xl font-bold text-gray-800 mb-2">
              {getYearsSinceJune2017()}
            </h4>
            <p className="text-gray-600">Anos de Ministério</p>
          </div>
          <div className="text-center">
            <div className="bg-green-100 rounded-full p-4 w-fit mx-auto mb-4">
              <Heart className="text-green-600" size={32} />
            </div>
            <h4 className="text-3xl font-bold text-gray-800 mb-2">12</h4>
            <p className="text-gray-600">Ministérios Ativos</p>
          </div>
          <div className="text-center">
            <div className="bg-purple-100 rounded-full p-4 w-fit mx-auto mb-4">
              <BookOpen className="text-purple-600" size={32} />
            </div>
            <h4 className="text-3xl font-bold text-gray-800 mb-2">1000+</h4>
            <p className="text-gray-600">Vidas Alcançadas</p>
          </div>
        </div>
      </Container>
    </section>
  );
};
