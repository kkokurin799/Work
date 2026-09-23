import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError } from "@/server/api";
import { createPerson, listPeople } from "@/server/catalog";

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return NextResponse.json({ items: await listPeople(archived) });
}

export async function POST(request: Request) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const body = await request.json();
    return NextResponse.json(await createPerson(String(body.name ?? ""), body.teamId ?? null), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
