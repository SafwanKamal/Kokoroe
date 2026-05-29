import { NextRequest, NextResponse } from "next/server";
import { destroyDevSession } from "../../../kokoroe-store";
import { clearSessionCookie, getSessionIdFromRequest } from "../session-cookie";

export async function POST(request: NextRequest) {
  await destroyDevSession(getSessionIdFromRequest(request));

  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
