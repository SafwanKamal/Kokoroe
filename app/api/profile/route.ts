import { NextRequest, NextResponse } from "next/server";
import { getDevSession, getPublicUser, updateProfile } from "../../kokoroe-store";
import { getSessionIdFromRequest } from "../auth/session-cookie";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? getSessionIdFromRequest(request);
  const result = await getDevSession(sessionId);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ profile: result.user.profile }, { status: result.status });
}

export async function PATCH(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const result = await updateProfile({
    ...body,
    sessionId: "sessionId" in body ? body.sessionId : getSessionIdFromRequest(request),
  });

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ profile: result.profile, user: getPublicUser(result.user) }, { status: result.status });
}
