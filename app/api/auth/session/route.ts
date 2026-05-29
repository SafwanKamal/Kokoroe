import { NextRequest, NextResponse } from "next/server";
import { getDevSession, getPublicUser } from "../../../kokoroe-store";
import { getSessionIdFromRequest } from "../session-cookie";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? getSessionIdFromRequest(request);

  if (!sessionId) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const result = await getDevSession(sessionId);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      authenticated: true,
      mode: "development",
      user: getPublicUser(result.user),
      session: result.session,
    },
    { status: result.status },
  );
}
