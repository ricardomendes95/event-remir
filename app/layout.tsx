import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import EmbeddedBrowserWarningModal from "@/components/EmbeddedBrowserWarningModal";
import { Header } from "@/components/Header";
import { SectionRefsProvider } from "@/contexts/SectionRefsContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Igreja Remir Caruaru",
  description: "Pagina oficial da Igreja Remir Caruaru",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SectionRefsProvider>
          <Header />
          <EmbeddedBrowserWarningModal />
          <div className="mt-16 lg:mt-20">{children}</div>
        </SectionRefsProvider>
      </body>
    </html>
  );
}
