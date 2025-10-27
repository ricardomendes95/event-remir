import Script from "next/script";

export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: "Igreja Remir Caruaru",
    alternateName: "Remir Caruaru",
    url: "https://igrejaremircaruaru.com.br",
    logo: "https://igrejaremircaruaru.com.br/logo.png",
    description:
      "Igreja evangélica em Caruaru, Pernambuco. Cultos, ministérios, eventos e comunidade cristã.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Rua Tomaz Antônio de Gonzaga, São Francisco",
      addressLocality: "Caruaru",
      addressRegion: "PE",
      postalCode: " 55008-520",
      addressCountry: "BR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "-8.287104737160984", // Adicione a latitude aqui
      longitude: "-35.98090407072136", // Adicione a longitude aqui
    },
    telephone: "+55-81-99477-0036", // Adicione o telefone aqui (formato: +55-81-XXXX-XXXX)
    email: "ministerioremir@gmail.com", // Adicione o email aqui
    sameAs: [
      "https://www.instagram.com/igrejaremircaruaru/",
      "https://www.facebook.com/ministerioremir",
      "https://www.youtube.com/@ministerioremir3524",
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Sunday"],
        opens: "17:00",
        closes: "17:00",
        description: "Domingo Profético",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["wednesday"],
        opens: "14:00",
        closes: "17:00",
        description: "Quarta-feira de Oração",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["wednesday"],
        opens: "20:00",
        closes: "21:30:00",
        description: "Café com Bíblia",
      },
      // Adicione outros horários de culto aqui
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Ministérios e Atividades",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Cultos de Adoração",
            description: "Encontros semanais para adoração e palavra",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Escola Bíblica",
            description: "Estudo sistemático da Palavra de Deus",
          },
        },
      ],
    },
    founder: {
      "@type": "Person",
      name: "Pr. Pedro Andrade", // Adicione o nome do fundador/pastor principal
    },
    foundingDate: "2017-01-01", // Adicione a data de fundação (formato: YYYY-MM-DD)
    areaServed: {
      "@type": "City",
      name: "Caruaru",
      containedIn: {
        "@type": "State",
        name: "Pernambuco",
      },
    },
  };

  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
