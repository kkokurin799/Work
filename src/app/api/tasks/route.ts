import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError } from "@/server/api";
import { readFilters } from "@/server/params";
import { createTask, listTasks } from "@/server/records";

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const url = new URL(request.url);
  const filters = readFilters(Object.fromEntries(url.searchParams.entries()));
  const items = await listTasks({
    ...filters,
    kind: url.searchParams.get("kind"),
    projectNumber: url.searchParams.get("project"),
    status: url.searchParams.get("status"),
    side: url.searchParams.get("side"),
    attention: url.searchParams.get("attention"),
    hot: url.searchParams.get("hot") === "1",
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const task = await createTask(await request.json(), auth.user.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
