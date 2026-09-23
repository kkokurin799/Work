import { NextResponse } from "next/server";
import { editorOrError, jsonError } from "@/server/api";
import { applyInboundForm } from "@/server/inbox";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const number = await applyInboundForm(id, body, auth.user.id);
    return NextResponse.json({ number });
  } catch (error) {
    return jsonError(error);
  }
}
