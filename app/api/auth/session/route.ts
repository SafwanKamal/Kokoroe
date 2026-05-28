import { NextRequest, NextResponse } from "next/server";
import { getDevSession } from "../../../kokoroe-store";

export async function GET(request: NextRequest) {
  const result = await getDevSession(request.nextUrl.searchParams.get("sessionId"));

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      mode: "development",
      user: result.user,
      session: result.session,
    },
    { status: result.status },
  );
}
