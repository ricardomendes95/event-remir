import { Button } from "@/components/ui/Button";
import { Container } from "../Container";
import {
  BookOpen,
  Brain,
  Building,
  Calendar,
  Globe,
  HandHeart,
  Heart,
  Users,
  X,
} from "lucide-react";
import { JSX, useState } from "react";
// Modal Component
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
          <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

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
  const [modalContent, setModalContent] = useState<{
    title: string;
    content: JSX.Element;
  } | null>(null);

  const openMissionModal = () => {
    setModalContent({
      title: "Nossa Missão",
      content: (
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-600">
            <h4 className="text-xl font-semibold text-blue-800 mb-3">
              Definição de REMIR
            </h4>
            <p className="text-gray-700 leading-relaxed text-lg font-medium mb-3">
              <strong>Remir significa:</strong> libertar; fazer com que algo,
              alguém, se torne livre.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Somos um ministério missionário fundamentado na doutrina dos
              Apóstolos, cujo foco é viver o propósito da Igreja e estabelecer o
              Reino do Senhor.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Nossos Quatro Pilares Fundamentais:
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <Brain className="text-blue-500 mb-3" size={32} />
                <h5 className="font-semibold text-gray-800 mb-2">
                  Conhecimento
                </h5>
                <p className="text-gray-600 text-sm">
                  Fundamentados na Palavra de Deus e na doutrina dos Apóstolos.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <HandHeart className="text-green-500 mb-3" size={32} />
                <h5 className="font-semibold text-gray-800 mb-2">Serviço</h5>
                <p className="text-gray-600 text-sm">
                  Servindo ao próximo através do sacerdócio dos filhos de Deus.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <Users className="text-purple-500 mb-3" size={32} />
                <h5 className="font-semibold text-gray-800 mb-2">
                  Relacionamento
                </h5>
                <p className="text-gray-600 text-sm">
                  Construindo vínculos genuínos na comunidade de fé.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <Heart className="text-red-500 mb-3" size={32} />
                <h5 className="font-semibold text-gray-800 mb-2">Adoração</h5>
                <p className="text-gray-600 text-sm">
                  Celebrando a Deus com todo nosso ser e devoção.
                </p>
              </div>
            </div>
          </div>

          <blockquote className="bg-gray-50 border-l-4 border-yellow-500 p-4 italic">
            <p className="text-gray-700 mb-2">
              {`"E perseveravam na doutrina dos apóstolos, e na comunhão, e no
              partir do pão, e nas orações."`}
            </p>
            <cite className="text-sm text-gray-500">— Atos 2:42</cite>
          </blockquote>
        </div>
      ),
    });
  };

  const openVisionModal = () => {
    setModalContent({
      title: "Nossa Visão",
      content: (
        <div className="space-y-6">
          <div className="bg-yellow-50 rounded-xl p-6 border-l-4 border-yellow-600">
            <h4 className="text-xl font-semibold text-yellow-800 mb-3">
              Visão Missionária
            </h4>
            <p className="text-gray-700 leading-relaxed">
              Desenvolvemos missões sustentáveis, transculturais, urbanas e
              ações sociais buscando transformar a sociedade através do
              sacerdócio dos filhos de Deus.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-800">
              Nossas Frentes de Atuação:
            </h4>

            <div className="space-y-4">
              <div className="flex items-start space-x-4 bg-green-50 p-4 rounded-lg">
                <div className="bg-green-100 rounded-full p-2">
                  <Globe className="text-green-600" size={24} />
                </div>
                <div>
                  <h5 className="font-medium text-gray-800">
                    Missões Transculturais
                  </h5>
                  <p className="text-gray-600 text-sm">
                    Alcançando diferentes culturas e povos com o Evangelho de
                    Cristo
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-blue-50 p-4 rounded-lg">
                <div className="bg-blue-100 rounded-full p-2">
                  <Building className="text-blue-600" size={24} />
                </div>
                <div>
                  <h5 className="font-medium text-gray-800">Missões Urbanas</h5>
                  <p className="text-gray-600 text-sm">
                    Impactando os centros urbanos com projetos de transformação
                    social
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-purple-50 p-4 rounded-lg">
                <div className="bg-purple-100 rounded-full p-2">
                  <HandHeart className="text-purple-600" size={24} />
                </div>
                <div>
                  <h5 className="font-medium text-gray-800">Ações Sociais</h5>
                  <p className="text-gray-600 text-sm">
                    Promovendo justiça social e cuidado aos mais necessitados
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-orange-50 p-4 rounded-lg">
                <div className="bg-orange-100 rounded-full p-2">
                  <Heart className="text-orange-600" size={24} />
                </div>
                <div>
                  <h5 className="font-medium text-gray-800">
                    Missões Sustentáveis
                  </h5>
                  <p className="text-gray-600 text-sm">
                    Desenvolvendo projetos que geram impacto duradouro e
                    transformador
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
            <h4 className="text-lg font-semibold mb-3">
              Sacerdócio de Todos os Santos
            </h4>
            <p className="text-blue-100 leading-relaxed">
              Cremos que cada filho de Deus é chamado para o sacerdócio, sendo
              instrumento de transformação na sociedade através do amor, serviço
              e testemunho cristão.
            </p>
          </div>

          <blockquote className="bg-gray-50 border-l-4 border-green-500 p-4 italic">
            <p className="text-gray-700 mb-2">
              {`"Mas vós sois a geração eleita, o sacerdócio real, a nação santa,
              o povo adquirido..."`}
            </p>
            <cite className="text-sm text-gray-500">— 1 Pedro 2:9</cite>
          </blockquote>
        </div>
      ),
    });
  };

  const closeModal = () => {
    setModalContent(null);
  };
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
              <Button variant="outline" onClick={openMissionModal}>
                Nossa Missão
              </Button>
              <Button variant="outline" onClick={openVisionModal}>
                Nossa Visão
              </Button>
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
      {/* Modal */}
      {modalContent && (
        <Modal isOpen={true} onClose={closeModal} title={modalContent.title}>
          {modalContent.content}
        </Modal>
      )}
    </section>
  );
};
