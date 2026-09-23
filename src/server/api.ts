import { NextResponse } from "next/server";
import { currentUser } from "./current";
import { InputError } from "./errors";
import { assertEditor } from "./auth";

export async function guard() {
  const user = await currentUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Нужно войти." }, { status: 401 }) };
  }
  return { user, error: null };
}

export function jsonError(error: unknown) {
  if (error instanceof InputError) return NextResponse.json({ fields: error.fields }, { status: 422 });
  console.error(error);
  return NextResponse.json({ error: "Внутренняя ошибка." }, { status: 500 });
}

export function notFound() {
  return NextResponse.json({ error: "Не найдено." }, { status: 404 });
}

export async function editorOrError() {
  const result = await guard();
  if (result.error || !result.user) return result;
  try {
    assertEditor(result.user);
  } catch (error) {
    return { user: null, error: jsonError(error) };
  }
  return result;
}
