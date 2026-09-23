import { NextResponse } from "next/server";
import { editorOrError, jsonError } from "@/server/api";
import { rejectInbound } from "@/server/inbox";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const { id } = await context.params;
    await rejectInbound(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
