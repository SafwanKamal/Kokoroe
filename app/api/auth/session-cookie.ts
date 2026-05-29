import { NextRequest, NextResponse } from "next/server";

export const sessionCookieName = "kokoroe_session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export function getSessionIdFromRequest(request: NextRequest) {
  return request.cookies.get(sessionCookieName)?.value;
}

export function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(sessionCookieName, sessionId, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
