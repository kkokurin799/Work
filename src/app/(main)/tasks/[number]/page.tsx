import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Mark, NamedSelect, StatusSelect, beneficiaryLabel, formatDate, sideLabel, sourceLabel } from "@/components/bits";
import { moscowToday } from "@/domain/dates";
import { BACKLOG_STATUSES, TASK_STATUSES, label } from "@/domain/labels";
import { updateTaskAction } from "@/server/actions";
import { listCatalog, listPeople } from "@/server/catalog";
import { getTask } from "@/server/records";

export default async function TaskPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const task = await getTask(decodeURIComponent(number));
  if (!task) notFound();
  const [products, teams, clients, people] = await Promise.all([
    listCatalog("products"),
    listCatalog("teams"),
    listCatalog("clients"),
    listPeople(),
  ]);
  const today = moscowToday();
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">
            {task.projectNumber ? <Link href={`/projects/${task.projectNumber}`}>{task.projectNumber} {task.projectName}</Link> : <Link href="/backlog">Бэклог</Link>}
            {" / "}{task.number}
          </p>
          <h1>{task.description}</h1>
          <p className="lead">
            {task.kind === "project_task" ? label(TASK_STATUSES, task.status) : label(BACKLOG_STATUSES, task.status)}
            {" · "}{task.assignee} · {task.teamName} · срок {formatDate(task.dueDate)} · {sourceLabel(task.source)}
          </p>
        </div>
        <Mark attention={task.attention} due={task.dueDate} today={today} />
      </header>
      <div className="meta" style={{ marginBottom: 16 }}>
        {task.kind === "project_task" ? <span>Сторона: {sideLabel(task.side)}</span> : <span>Для кого: {beneficiaryLabel(task.beneficiary, task.clientName)}</span>}
        <span>Продукт: {task.productName}</span>
        {task.externalNumber ? <span>Внешний номер: {task.externalNumber}</span> : null}
        {task.inboundMessageId ? <Link href={`/inbox/${task.inboundMessageId}`}>Исходное сообщение</Link> : null}
      </div>
      <form action={updateTaskAction} className="panel form-grid">
        <input type="hidden" name="number" value={task.number} />
        <input type="hidden" name="recordKind" value={task.kind} />
        {task.projectNumber ? <input type="hidden" name="projectNumber" value={task.projectNumber} /> : null}
        <label className="field wide">Описание<textarea name="description" defaultValue={task.description} required /></label>
        <label className="field">Ответственный<input name="assigneeName" defaultValue={task.assignee} list="people" required /></label>
        <NamedSelect labelText="Команда" name="teamId" rows={teams} value={task.teamId} />
        {task.kind === "project_task" ? (
          <label className="field">Сторона
            <select name="side" defaultValue={task.side ?? "ours"}>
              <option value="ours">Мы</option>
              <option value="client">Клиент</option>
              <option value="partner">Партнёр</option>
            </select>
          </label>
        ) : (
          <>
            <NamedSelect labelText="Продукт" name="productId" rows={products} value={task.productId} />
            <label className="field">Для кого
              <select name="beneficiary" defaultValue={task.beneficiary ?? "internal"}>
                <option value="client">Конкретный клиент</option>
                <option value="all_clients">Все клиенты</option>
                <option value="internal">Внутреннее</option>
              </select>
            </label>
            <NamedSelect labelText="Клиент" name="clientId" rows={clients} value={task.clientId} empty="Не выбран" />
          </>
        )}
        <StatusSelect kind={task.kind === "project_task" ? "task" : "backlog"} value={task.status} />
        <label className="field">Срок<input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} /></label>
        <label className="field">Внешний номер<input name="externalNumber" defaultValue={task.externalNumber ?? ""} /></label>
        <button className="primary" type="submit">Сохранить</button>
      </form>
      <datalist id="people">{people.map((person) => <option key={person.id} value={person.name} />)}</datalist>
      <section className="section">
        <h2>История</h2>
        <History items={task.activity} />
      </section>
    </>
  );
}
