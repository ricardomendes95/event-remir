import type { Metadata } from "next";
import { Container } from "@/components/home/Container";
import { ConsentPreferencesButton } from "@/components/ConsentPreferencesButton";

export const metadata: Metadata = {
  title: "Política de Privacidade | Igreja Remir Caruaru",
  description:
    "Como a Igreja Remir Caruaru coleta, usa e protege os seus dados pessoais, conforme a LGPD.",
};

const CONTACT_EMAIL = "ministerioremir@gmail.com";

export default function PrivacidadePage() {
  return (
    <main className="bg-gray-50 py-12 md:py-16">
      <Container>
        <article className="mx-auto max-w-3xl space-y-8 rounded-2xl bg-white p-6 text-gray-700 shadow-sm md:p-10">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Política de Privacidade
            </h1>
            <p className="text-sm text-gray-500">
              Última atualização: 11 de novembro de 2026
            </p>
          </header>

          <section className="space-y-3">
            <p>
              A Igreja Remir Caruaru respeita a sua privacidade. Esta página
              explica, de forma simples, quais dados coletamos neste site, para
              que usamos e quais são os seus direitos, conforme a Lei Geral de
              Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              1. Dados que coletamos
            </h2>
            <p>
              <strong>Ao se inscrever em um evento:</strong> nome, CPF, e-mail,
              telefone, as respostas do formulário do evento e, quando houver, a
              escolha de camisa e o tamanho. O CPF serve para evitar inscrições
              duplicadas e para você consultar o seu comprovante.
            </p>
            <p>
              <strong>Ao navegar pelo site, somente se você aceitar:</strong> as
              páginas visitadas, a página de origem, o tipo de navegador, um
              identificador anônimo de visita e, se você também permitir no
              navegador, a sua localização aproximada.
            </p>
            <p>
              <strong>Pagamentos:</strong> são feitos no ambiente da
              InfinitePay. Nós não recebemos nem guardamos os dados do seu
              cartão.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              2. Para que usamos os dados
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Registrar e confirmar a sua inscrição e o pagamento.</li>
              <li>Emitir o comprovante e fazer o check-in no dia do evento.</li>
              <li>Entrar em contato sobre o evento em que você se inscreveu.</li>
              <li>
                Entender como o site é usado e de onde vêm os visitantes, para
                melhorar os nossos eventos (somente com o seu consentimento).
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              3. Bases legais
            </h2>
            <p>
              Os dados de inscrição são tratados para cumprir o que você nos
              pediu ao se inscrever (art. 7º, V, da LGPD). Os dados de navegação
              e de localização são tratados somente com o seu consentimento
              (art. 7º, I), que pode ser retirado a qualquer momento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              4. Compartilhamento
            </h2>
            <p>
              Não vendemos os seus dados. Eles são compartilhados apenas com os
              serviços necessários para o site funcionar: a InfinitePay
              (pagamentos), a hospedagem do site e o banco de dados onde as
              informações ficam guardadas.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              5. Por quanto tempo guardamos
            </h2>
            <p>
              Os dados de inscrição e de navegação ficam guardados sem prazo
              definido, para manter o histórico dos eventos e das visitas ao
              site. Eles só são apagados quando você pedir a exclusão pelo
              contato abaixo, exceto o que precisarmos manter por obrigação
              legal.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              6. Armazenamento no seu navegador
            </h2>
            <p>
              Guardamos no seu navegador a sua escolha sobre esta política e,
              se você aceitar, o identificador anônimo de visita. A área
              administrativa usa um cookie de login apenas para a equipe da
              igreja.
            </p>
            <p>
              <strong>Transmissões (YouTube):</strong> a página de transmissões
              só carrega o player do YouTube depois que você toca no vídeo. A
              partir daí, o YouTube (Google) pode usar cookies e coletar dados
              do seu acesso, conforme a política de privacidade dele. Se você
              não tocar no vídeo, nada é carregado do YouTube.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              7. Seus direitos
            </h2>
            <p>
              Você pode pedir, a qualquer momento, para confirmar se tratamos os
              seus dados, acessar, corrigir ou excluir esses dados, e retirar o
              seu consentimento. Basta escrever para{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-[#015C91] underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p>
              Para mudar agora a sua escolha sobre os dados de navegação e de
              localização:{" "}
              <ConsentPreferencesButton className="font-medium text-[#015C91]">
                alterar minha escolha
              </ConsentPreferencesButton>
              .
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
