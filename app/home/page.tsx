"use client";
import React, { useState, useEffect } from "react";
import {
  Menu,
  X,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
  Heart,
  BookOpen,
} from "lucide-react";
import Image from "next/image";

// Componente Button reutilizável
type ButtonProps = {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const baseClasses =
    "font-medium rounded-lg transition-all duration-300 inline-flex items-center justify-center";
  const variants = {
    primary:
      "bg-[#015C91] hover:bg-[#014B7A] text-white shadow-lg hover:shadow-xl",
    secondary:
      "bg-[#88CDF6] hover:bg-[#6BB9EB] text-white shadow-lg hover:shadow-xl",
    outline:
      "border-2 border-[#015C91] text-[#015C91] hover:bg-[#015C91] hover:text-white",
  };
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} cursor-pointer`}
      {...props}
    >
      {children}
    </button>
  );
};

// Componente Card reutilizável
type CardProps = {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  image?: string;
  className?: string;
};

const Card: React.FC<CardProps> = ({
  title,
  description,
  icon: Icon,
  image,
  className = "",
}) => {
  return (
    <div
      className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100 ${className} relative`}
    >
      {image && (
        <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
          <Image src={image} alt={title} fill className="object-cover" />
        </div>
      )}
      {Icon && (
        <div className="bg-blue-100 rounded-full p-3 w-fit mb-4 absolute top-2 left-2">
          <Icon className="text-[#015C91]" size={24} />
        </div>
      )}
      <h3 className="text-xl font-semibold text-[var(--color-primary-700)] mb-3">
        {title}
      </h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
};

// Componente Container reutilizável
const Container: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

// Header Component
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { label: "Início", href: "#home" },
    { label: "Sobre", href: "#about" },
    { label: "Pastores", href: "#pastors" },
    { label: "Ministérios", href: "#ministries" },
    { label: "Eventos", href: "#events" },
    { label: "Localização", href: "#location" },
    { label: "Contato", href: "#contact" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[var(--color-primary-100)] shadow-lg"
          : "bg-[var(--color-primary-100)]/90 backdrop-blur-sm"
      }`}
    >
      <Container>
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="Igreja Remir Logo"
                width={60}
                height={40}
              />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-[#015C91]">
                Igreja Remir
              </h1>
              <p className="text-xs text-gray-500 hidden lg:block">
                Chamados à liberdade
              </p>
            </div>
          </div>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center space-x-8">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-gray-700 hover:text-[#015C91] font-medium transition-colors duration-300 relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#015C91] group-hover:w-full transition-all duration-300"></span>
              </a>
            ))}
          </nav>

          {/* CTA Button */}
          <div className="hidden lg:flex">
            <Button variant="primary">Visite-nos</Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-[#015C91] transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white border-t shadow-lg">
            <nav className="py-4">
              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-3 text-gray-700 hover:text-[#015C91] hover:bg-blue-50 transition-colors duration-300"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="px-4 py-3">
                <Button variant="primary" className="w-full">
                  Visite-nos
                </Button>
              </div>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
};

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
const HeroSection = () => {
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
              <Button
                variant="primary"
                size="lg"
                className="flex-1 sm:flex-none"
              >
                <Heart className="mr-2" size={20} />
                Conheça Nossa História
              </Button>
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

// Pastors Section
const PastorsSection = () => {
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

                  <div className="pt-4">
                    <Button variant="outline">
                      <Heart className="mr-2" size={20} />
                      Conheça Nossa Liderança
                    </Button>
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

// About Section
const AboutSection = () => {
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

// Ministries Section
const MinistriesSection = () => {
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

// Location Section
const LocationSection = () => {
  return (
    <section id="location" className="py-20 bg-white">
      <Container>
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-800 mb-6">
            Nossa Localização
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Venha nos visitar! Estamos localizados no coração de Caruaru, em um
            local de fácil acesso para toda a família.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Map */}
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-6 shadow-xl">
              <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3950.5449027951835!2d-35.98304492503731!3d-8.287132391862374!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7a98b97de993fa7%3A0x74e139b331042cd1!2sMinist%C3%A9rio%20Remir!5e0!3m2!1spt-BR!2sbr!4v1693934400000!5m2!1spt-BR!2sbr"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Localização da Igreja Remir"
                ></iframe>
              </div>
            </div>
          </div>

          {/* Location Info */}
          <div>
            <h3 className="text-3xl font-bold text-gray-800 mb-6">
              Como Chegar
            </h3>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-100 rounded-full p-3 min-w-fit">
                  <MapPin className="text-[#015C91]" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Endereço</h4>
                  <p className="text-gray-600 leading-relaxed">
                    Rua Tomaz Antônio de Gonzaga, 222-120
                    <br />
                    São Francisco, Caruaru - PE
                    <br />
                    CEP: 55008-520
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-green-100 rounded-full p-3 min-w-fit">
                  <Phone className="text-green-600" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Contato</h4>
                  <p className="text-gray-600">(81) 9477-0036</p>
                  <p className="text-gray-600">ministerioremir@gmail.com</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-yellow-100 rounded-full p-3 min-w-fit">
                  <Calendar className="text-yellow-600" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">
                    Horários de Funcionamento
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-[#015C91]">
                        Domingo:
                      </span>
                      <span className="text-gray-600 ml-2">15h00 e 17h00</span>
                    </div>
                    <div>
                      <span className="font-medium text-[#015C91]">
                        Quarta-feira:
                      </span>
                      <span className="text-gray-600 ml-2">
                        13h00, 14h00 e 20h00
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Button
                variant="primary"
                className="flex-1 sm:flex-none"
                onClick={() =>
                  window.open(
                    "https://maps.app.goo.gl/cRBtoigkTLunVQsS6",
                    "_blank"
                  )
                }
              >
                <MapPin className="mr-2" size={20} />
                Ver no Google Maps
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => window.open("tel:+5581947700036")}
              >
                <Phone className="mr-2" size={20} />
                Ligar Agora
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer className="bg-[#015C91] text-white py-16">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-3 mb-6">
              <Image
                src={"/logo-branca.png"}
                alt="Igreja Remir Logo"
                width={60}
                height={40}
              />
              <h3 className="text-2xl font-bold">Igreja Remir</h3>
            </div>
            <p className="text-gray-300 leading-relaxed mb-6">
              Uma igreja comprometida em renovar vidas através do amor de
              Cristo, construindo uma comunidade de fé, esperança e amor.
            </p>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Contato</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-white">
                <MapPin size={20} className="min-w-[20px]" />
                <a
                  href="https://maps.app.goo.gl/cRBtoigkTLunVQsS6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  <span>
                    Rua Tomaz Antônio de Gonzaga
                    <br />
                    São Francisco, Caruaru - PE
                  </span>
                </a>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <Phone size={20} />
                <span>(81) 9477-0036</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <Mail size={20} />
                <span>ministerioremir@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Service Times */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Horários</h4>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-blue-400">Domingo</p>
                <p className="text-gray-300">15h00 e 17h00</p>
              </div>
              <div>
                <p className="font-medium text-blue-400">Quarta-feira</p>
                <p className="text-gray-300">20h00</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 Igreja Remir. Todos os direitos reservados.
          </p>
        </div>
      </Container>
    </footer>
  );
};

// Main App Component
const home = () => {
  return (
    <div>
      <Header />
      <main>
        <HeroSection />
        <AboutSection />
        <PastorsSection />
        <MinistriesSection />
        <LocationSection />
      </main>
      <Footer />
    </div>
  );
};

export default home;
