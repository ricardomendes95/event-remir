import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import EmbeddedBrowserWarningModal from "@/components/EmbeddedBrowserWarningModal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SectionRefsProvider } from "@/contexts/SectionRefsContext";
import { StructuredData } from "@/components/StructuredData";
import { PageTracker } from "@/components/PageTracker";
import { AntdProvider } from "@/components/AntdProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Igreja Remir Caruaru | Igreja Evangélica em Caruaru - PE",
    template: "%s | Igreja Remir Caruaru",
  },
  description:
    "Igreja Remir Caruaru - Igreja evangélica em Caruaru, Pernambuco. Cultos, ministérios, eventos e comunidade cristã. Venha nos visitar e fazer parte da nossa família.",
  keywords: [
    "igreja em caruaru",
    "igreja evangélica em caruaru",
    "igreja caruaru",
    "igreja evangelica caruaru",
    "igreja remir",
    "remir caruaru",
    "culto caruaru",
    "igreja pernambuco",
    "comunidade cristã caruaru",
    "ministérios igreja",
    "eventos gospel caruaru",
  ],
  authors: [{ name: "Igreja Remir Caruaru" }],
  creator: "Igreja Remir Caruaru",
  publisher: "Igreja Remir Caruaru",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://igrejaremircaruaru.com.br"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Igreja Remir Caruaru | Igreja Evangélica em Caruaru - PE",
    description:
      "Igreja Remir Caruaru - Igreja evangélica em Caruaru, Pernambuco. Cultos, ministérios, eventos e comunidade cristã. Venha nos visitar!",
    url: "https://igrejaremircaruaru.com.br",
    siteName: "Igreja Remir Caruaru",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Igreja Remir Caruaru",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Igreja Remir Caruaru | Igreja Evangélica em Caruaru - PE",
    description:
      "Igreja evangélica em Caruaru, Pernambuco. Cultos, ministérios, eventos e comunidade cristã.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "CX0QsaSJuqDeThSk38iJ_SxZvc1IU0_sPALAsspvUAE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
      >
        <StructuredData />
        <PageTracker />
        <AntdProvider>
          <SectionRefsProvider>
            <Header />
            <EmbeddedBrowserWarningModal />
            <div className="mt-16 lg:mt-20 flex-1">{children}</div>
            <Footer />
          </SectionRefsProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
