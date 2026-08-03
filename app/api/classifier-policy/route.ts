import { NextResponse } from "next/server";
import { getMessageClassifierPublicPolicy } from "../../message-classifier-runtime";

export async function GET() {
  return NextResponse.json(getMessageClassifierPublicPolicy());
}
