import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assertEditor, userById, type CurrentUser } from "./auth";
import { readSession } from "./session";

const COOKIE = "work_session";

export async function currentUser(): Promise<CurrentUser | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const userId = readSession(jar.get(COOKIE)?.value, secret);
  if (!userId) return null;
  return userById(userId);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function editor(): Promise<CurrentUser> {
  const user = await requireUser();
  assertEditor(user);
  return user;
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}
