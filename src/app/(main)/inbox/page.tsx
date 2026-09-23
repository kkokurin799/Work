import Link from "next/link";
import { formatStamp } from "@/domain/dates";
import { listInbox } from "@/server/inbox";
import { one } from "@/server/params";

const TITLES: Record<string, string> = {
  needs_review: "Нужен разбор",
  applied: "Проведено",
  rejected: "Отклонено",
  duplicate: "Повтор",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = one(params, "status");
  const items = await listInbox(status || null);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Входящие</h1>
          <p className="lead">Письма и сообщения сохраняются целиком. Неразобранное остаётся здесь.</p>
        </div>
      </header>
      <div className="meta" style={{ marginBottom: 12 }}>
        <Link href="/inbox">Все</Link>
        <Link href="/inbox?status=needs_review">Нужен разбор</Link>
        <Link href="/inbox?status=applied">Проведённые</Link>
      </div>
      {items.length ? (
        <div className="cards">
          {items.map((item) => (
            <Link key={item.id} href={`/inbox/${item.id}`} className="card">
              <div className="card-top">
                <span className="kicker">{item.channel === "email" ? "Почта" : "Telegram"} · {item.sender}</span>
                <span className="chip">{TITLES[item.parseStatus] ?? item.parseStatus}</span>
              </div>
              <p>{item.rawText.slice(0, 220)}</p>
              <div className="meta"><span>{formatStamp(item.receivedAt)}</span>{item.parseError ? <span>{item.parseError}</span> : null}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel empty">Входящих в этом срезе нет.</div>
      )}
    </>
  );
}
