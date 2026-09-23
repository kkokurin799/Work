import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError } from "@/server/api";
import { readFilters } from "@/server/params";
import { createProject, listProjects } from "@/server/records";

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const url = new URL(request.url);
  const filters = readFilters(Object.fromEntries(url.searchParams.entries()));
  return NextResponse.json({ items: await listProjects(filters, url.searchParams.get("lifecycle")) });
}

export async function POST(request: Request) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const body = await request.json();
    const project = await createProject(body, auth.user.id);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
