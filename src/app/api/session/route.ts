import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth";
import { sessionCookie } from "@/server/current";
import { jsonError } from "@/server/api";
import { signSession } from "@/server/session";

export async function POST(request: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: "SESSION_SECRET не задан." }, { status: 500 });
  try {
    const body = await request.json();
    const user = await authenticate(String(body.email ?? ""), String(body.password ?? ""));
    const jar = await cookies();
    const cookie = sessionCookie(signSession(user.id, secret));
    jar.set(cookie.name, cookie.value, cookie.options);
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(sessionCookie("").name);
  return NextResponse.json({ ok: true });
}
