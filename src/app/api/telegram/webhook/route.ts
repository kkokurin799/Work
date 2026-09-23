import { NextResponse } from "next/server";
import { ingest } from "@/server/inbox";
import { sendTelegram, telegramAllowed, webhookSecretOk } from "@/server/telegram";

export async function POST(request: Request) {
  if (!webhookSecretOk(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new NextResponse("forbidden", { status: 401 });
  }
  const update = await request.json();
  const message = update?.message;
  if (!message?.text) return NextResponse.json({ ok: true });
  const allowed = telegramAllowed(message.from?.id);
  const result = await ingest({
    channel: "telegram",
    externalId: String(update.update_id),
    sender: String(message.from?.id ?? ""),
    rawText: String(message.text),
    allowed,
    telegramUserId: message.from?.id ? String(message.from.id) : null,
    telegramChatId: message.chat?.id ? String(message.chat.id) : null,
  });
  if (allowed && result.reply && message.chat?.id) {
    try {
      await sendTelegram(String(message.chat.id), result.reply);
    } catch (error) {
      console.error("telegram reply", error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.json({ ok: true });
}
