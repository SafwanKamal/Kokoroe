import { NextResponse } from "next/server";
import { getRoomsPayload } from "../../kokoroe-store";

export function GET() {
  return NextResponse.json(getRoomsPayload());
}
