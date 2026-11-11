import { NextResponse } from "next/server";
import { getLivesData } from "@/backend/services/youtubeLivesService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLivesData();
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Erro ao carregar as transmissões" },
      { status: 500 },
    );
  }
}
