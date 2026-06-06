import { NextResponse } from "next/server";
import { getBackendHealth } from "../../kokoroe-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getBackendHealth());
  } catch (error) {
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown health check failure.",
        status: "error",
      },
      { status: 503 },
    );
  }
}
