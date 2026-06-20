import { NextRequest, NextResponse } from "next/server";
import { createRoomMember, searchAccounts } from "../../kokoroe-store";
import { getSessionIdFromRequest, sessionErrorResponse } from "../auth/session-cookie";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? getSessionIdFromRequest(request);
  const result = await searchAccounts({
    query: request.nextUrl.searchParams.get("query"),
    roomId: request.nextUrl.searchParams.get("roomId"),
    sessionId,
  });

  if ("error" in result) {
    return sessionErrorResponse(result.error ?? "Member search failed.", result.status);
  }

  return NextResponse.json({ accounts: result.accounts }, { status: result.status });
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

  const result = await createRoomMember(body);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      account: result.account,
      membersByRoom: result.membersByRoom,
    },
    { status: result.status },
  );
}
