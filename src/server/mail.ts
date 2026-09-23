import { ingest } from "./inbox";

export async function pollMailbox(): Promise<number> {
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  if (!host || !user || !password) return 0;
  const allowed = (process.env.IMAP_ALLOWED_FROM ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const { ImapFlow } = await import(/* webpackIgnore: true */ "imapflow");
  const client = new ImapFlow({
    host,
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user, pass: password },
  });
  let handled = 0;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const unseen = await client.search({ seen: false });
    if (!unseen) return 0;
    for (const uid of unseen) {
      const message = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
      if (!message || !message.envelope) continue;
      const subject = message.envelope.subject ?? "";
      if (!subject.startsWith("[Work]")) continue;
      const from = message.envelope.from?.[0]?.address?.toLowerCase() ?? "";
      const id = message.envelope.messageId || `${uid}`;
      const text = sourceText(message.source);
      await ingest({
        channel: "email",
        externalId: id,
        sender: from,
        rawText: text,
        allowed: allowed.includes(from),
      });
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      handled += 1;
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return handled;
}

function sourceText(source: Buffer | undefined): string {
  const raw = source?.toString("utf8") ?? "";
  const split = raw.split(/\r?\n\r?\n/);
  return (split.slice(1).join("\n\n") || raw).trim();
}
