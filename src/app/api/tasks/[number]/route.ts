import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError, notFound } from "@/server/api";
import { getTask, updateTask } from "@/server/records";

type Context = { params: Promise<{ number: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const { number } = await context.params;
  const task = await getTask(number);
  if (!task) return notFound();
  return NextResponse.json(task);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const { number } = await context.params;
    return NextResponse.json(await updateTask(number, await request.json(), auth.user.id));
  } catch (error) {
    return jsonError(error);
  }
}
