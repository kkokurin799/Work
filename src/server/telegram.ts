export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан.");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram ответил ${response.status}: ${body.slice(0, 300)}`);
  }
}

export function telegramAllowed(userId: number | string | undefined): boolean {
  const owner = process.env.TELEGRAM_OWNER_USER_ID;
  if (!owner || userId === undefined) return false;
  return String(userId) === owner;
}

export function webhookSecretOk(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(secret) && header === secret;
}
