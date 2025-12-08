import { NextRequest } from "next/server";
import { PageViewController } from "../../../backend/controllers/PageViewController";

const pageViewController = new PageViewController();

// POST /api/analytics - Track page view
export async function POST(request: NextRequest) {
  return await pageViewController.trackPageView(request);
}

// GET /api/analytics - Get page view statistics
export async function GET(request: NextRequest) {
  return await pageViewController.getPageStats(request);
}
