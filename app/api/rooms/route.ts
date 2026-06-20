import { NextRequest, NextResponse } from "next/server";
import { getRoomsPayload, joinRoom } from "../../kokoroe-store";
import { getSessionIdFromRequest, sessionErrorResponse } from "../auth/session-cookie";

export async function GET() {
  return NextResponse.json(await getRoomsPayload());
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const result = await joinRoom({
    ...body,
    sessionId: "sessionId" in body ? body.sessionId : getSessionIdFromRequest(request),
  });

  if ("error" in result) {
    return sessionErrorResponse(result.error ?? "Room join failed.", result.status);
  }

  return NextResponse.json(
    {
      membersByRoom: result.membersByRoom,
      profile: result.profile,
    },
    { status: result.status },
  );
}
