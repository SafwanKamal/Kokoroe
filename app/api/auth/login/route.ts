import { NextRequest, NextResponse } from "next/server";
import { createDevSession } from "../../../kokoroe-store";

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

  return NextResponse.json(
    {
      mode: "development",
      user: result.user,
      session: result.session,
    },
    { status: result.status },
  );
}
