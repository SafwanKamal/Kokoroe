import { NextRequest, NextResponse } from "next/server";
import { createDevSession, getPublicUser } from "../../../kokoroe-store";
import { setSessionCookie } from "../session-cookie";

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

  const result = await createDevSession(body);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json(
    {
      mode: "development",
      user: getPublicUser(result.user),
      session: result.session,
    },
    { status: result.status },
  );

  setSessionCookie(response, result.session.id);
  return response;
}
