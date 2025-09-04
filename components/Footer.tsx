import Image from "next/image";
import { Container } from "./home/Container";
import { MapPin, Phone, Mail } from "lucide-react";

// Footer Component
export const Footer = () => {
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
