import { NextResponse } from "next/server";
import { guard } from "@/server/api";
import { listInbox } from "@/server/inbox";

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const status = new URL(request.url).searchParams.get("status");
  return NextResponse.json({ items: await listInbox(status) });
}
