import { NextResponse } from "next/server";
import { editorOrError, jsonError, notFound } from "@/server/api";
import { listPeople, updatePerson } from "@/server/catalog";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await editorOrError();
  if (auth.error || !auth.user) return auth.error;
  try {
    const { id } = await context.params;
    const body = await request.json();
    await updatePerson(id, { name: body.name, teamId: body.teamId, archived: body.archived });
    const person = (await listPeople(true)).find((item) => item.id === id);
    if (!person) return notFound();
    return NextResponse.json(person);
  } catch (error) {
    return jsonError(error);
  }
}
