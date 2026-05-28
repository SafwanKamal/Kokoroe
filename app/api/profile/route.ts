import { NextRequest, NextResponse } from "next/server";
import { getDevSession, updateProfile } from "../../kokoroe-store";

export async function GET(request: NextRequest) {
  const result = await getDevSession(request.nextUrl.searchParams.get("sessionId"));

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

  const result = await updateProfile(body);

  if (result.status !== 200) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ profile: result.profile, user: result.user }, { status: result.status });
}
