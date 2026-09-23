import Link from "next/link";
import { notFound } from "next/navigation";
import { formatStamp } from "@/domain/dates";
import { NamedSelect } from "@/components/bits";
import { applyInboundAction, rejectInboundAction } from "@/server/actions";
import { listCatalog } from "@/server/catalog";
import { getInbound } from "@/server/inbox";

export default async function InboxItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const message = await getInbound(id);
  if (!message) notFound();
  const [products, clients, teams] = await Promise.all([
    listCatalog("products"),
    listCatalog("clients"),
    listCatalog("teams"),
  ]);
  const fields = fieldsOf(message.parsed);
  const kind = kindOf(message.parsed);
  return (
    <>
      <p className="kicker"><Link href="/inbox">Входящие</Link> / {message.channel}</p>
      <header className="page-head">
        <div>
          <h1>{message.sender}</h1>
          <p className="lead">{formatStamp(message.receivedAt)} · {message.parseStatus}</p>
        </div>
      </header>
      {message.parseError ? <div className="banner">{message.parseError}</div> : null}
      <pre className="raw">{message.rawText}</pre>
      {message.parseStatus === "needs_review" ? (
        <form action={applyInboundAction} className="panel form-grid section">
          <input type="hidden" name="id" value={message.id} />
          <label className="field">Куда провести
            <select name="recordKind" defaultValue={kind}>
              <option value="project">Проект</option>
              <option value="project_task">Задача проекта</option>
              <option value="backlog">Бэклог</option>
            </select>
          </label>
          <label className="field">Название проекта<input name="name" defaultValue={fields["Название"] ?? ""} /></label>
          <label className="field">Номер проекта<input name="projectNumber" defaultValue={fields["Проект"] ?? ""} /></label>
          <label className="field wide">Описание<textarea name="description" defaultValue={fields["Описание"] ?? message.rawText} /></label>
          <NamedSelect labelText="Продукт" name="productId" rows={products} />
          <NamedSelect labelText="Клиент" name="clientId" rows={clients} empty="Не выбран" />
          <NamedSelect labelText="Команда" name="teamId" rows={teams} />
          <label className="field">Ответственный<input name="assigneeName" defaultValue={fields["Ответственный"] ?? ""} /></label>
          <label className="field">Сторона
            <select name="side" defaultValue="ours">
              <option value="ours">Мы</option>
              <option value="client">Клиент</option>
              <option value="partner">Партнёр</option>
            </select>
          </label>
          <label className="field">Для кого
            <select name="beneficiary" defaultValue="client">
              <option value="client">Конкретный клиент</option>
              <option value="all_clients">Все клиенты</option>
              <option value="internal">Внутреннее</option>
            </select>
          </label>
          <label className="field">Срок<input name="dueDate" type="date" /></label>
          <div className="wide" style={{ display: "flex", gap: 8 }}>
            <button className="primary" type="submit">Провести</button>
          </div>
        </form>
      ) : null}
      {message.parseStatus === "needs_review" ? (
        <form action={rejectInboundAction}>
          <input type="hidden" name="id" value={message.id} />
          <button className="ghost" type="submit">Отклонить</button>
        </form>
      ) : null}
      {message.projectId ? <p><Link href="/projects">К проектам</Link></p> : null}
    </>
  );
}

function fieldsOf(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== "object" || !("fields" in parsed)) return {};
  const fields = (parsed as { fields?: Record<string, string> }).fields;
  return fields ?? {};
}

function kindOf(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return "backlog";
  const type = String((parsed as { type?: string }).type);
  if (type === "project") return "project";
  if (type === "task") return "project_task";
  return "backlog";
}
