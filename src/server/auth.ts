import { query } from "../db/pool";
import { hashPassword, verifyPassword } from "./password";
import { InputError } from "./errors";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "editor" | "viewer";
  telegramChatId: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: CurrentUser["role"];
  telegram_chat_id: string | null;
  password_hash?: string;
  is_active?: boolean;
};

function mapUser(row: UserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    telegramChatId: row.telegram_chat_id,
  };
}

export async function seedOwner(): Promise<void> {
  const email = process.env.OWNER_EMAIL?.trim();
  const password = process.env.OWNER_PASSWORD;
  const preset = process.env.OWNER_PASSWORD_HASH;
  if (!email || (!password && !preset)) return;
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE lower(email) = lower($1)", [email]);
  if (existing.length) return;
  const passwordHash = preset || (await hashPassword(password!));
  await query("INSERT INTO users (email, name, password_hash, role) VALUES ($1, 'Владелец', $2, 'owner')", [
    email,
    passwordHash,
  ]);
}

export async function authenticate(email: string, password: string): Promise<CurrentUser> {
  const rows = await query<UserRow & { password_hash: string; is_active: boolean }>(
    "SELECT id, email, name, role, telegram_chat_id, password_hash, is_active FROM users WHERE lower(email) = lower($1)",
    [email.trim()],
  );
  const user = rows[0];
  if (!user || Number(user.is_active) === 0 || !(await verifyPassword(password, user.password_hash))) {
    throw new InputError({ password: "Неверная почта или пароль." });
  }
  return mapUser(user);
}

export async function userById(id: string): Promise<CurrentUser | null> {
  const rows = await query<UserRow>(
    "SELECT id, email, name, role, telegram_chat_id FROM users WHERE id = $1 AND is_active",
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function rememberTelegramChat(userId: string, telegramUserId: string, chatId: string): Promise<void> {
  await query("UPDATE users SET telegram_user_id = $2, telegram_chat_id = $3 WHERE id = $1", [
    userId,
    telegramUserId,
    chatId,
  ]);
}

export async function ownerChat(): Promise<{ userId: string; chatId: string | null } | null> {
  const rows = await query<{ id: string; telegram_chat_id: string | null }>(
    "SELECT id, telegram_chat_id FROM users WHERE role = 'owner' AND is_active ORDER BY created_at LIMIT 1",
  );
  if (!rows[0]) return null;
  return { userId: rows[0].id, chatId: rows[0].telegram_chat_id };
}

export function assertEditor(user: CurrentUser): void {
  if (user.role === "viewer") throw new InputError({ role: "Недостаточно прав для изменения." });
}
