import type { Metadata } from "next";
import { Suspense } from "react";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import EventPageContent from "./EventPageContent";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;

  const event = await withPrismaRetry(() =>
    prisma.event.findUnique({
      where: { slug },
      select: { title: true, description: true, bannerUrl: true },
    })
  );

  if (!event) {
    return { title: "Evento não encontrado" };
  }

  const plainDescription = event.description ? stripHtml(event.description) : "";
  const description = truncate(plainDescription, 160);

  const images = event.bannerUrl
    ? [{ url: event.bannerUrl, width: 1200, height: 630, alt: event.title }]
    : [];

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      images,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: event.bannerUrl ? [event.bannerUrl] : [],
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <EventPageContent slug={slug} />
    </Suspense>
  );
}
