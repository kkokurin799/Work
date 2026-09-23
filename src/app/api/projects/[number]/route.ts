import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError, notFound } from "@/server/api";
import { getProject, updateProject } from "@/server/records";

type Context = { params: Promise<{ number: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const { number } = await context.params;
  const project = await getProject(number);
  if (!project) return notFound();
  return NextResponse.json(project);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const { number } = await context.params;
    const project = await updateProject(number, await request.json(), auth.user.id);
    return NextResponse.json(project);
  } catch (error) {
    return jsonError(error);
  }
}
