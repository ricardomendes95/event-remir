import { Button } from "@/components/ui/Button";
import { Container } from "../Container";
import { MapPin, Phone, Calendar } from "lucide-react";

// Location Section
export const LocationSection = () => {
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
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(
                      "https://maps.app.goo.gl/cRBtoigkTLunVQsS6",
                      "_blank"
                    );
                  }
                }}
              >
                <MapPin className="mr-2" size={20} />
                Ver no Google Maps
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open("tel:+5581947700036");
                  }
                }}
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
