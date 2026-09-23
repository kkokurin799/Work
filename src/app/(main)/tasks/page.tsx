import Link from "next/link";
import { Mark, beneficiaryLabel, formatDate, sideLabel } from "@/components/bits";
import { moscowToday } from "@/domain/dates";
import { one, readFilters } from "@/server/params";
import { listTasks } from "@/server/records";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const items = await listTasks({
    ...filters,
    kind: one(params, "kind") || null,
    status: one(params, "status") || null,
    side: one(params, "side") || null,
    attention: one(params, "attention") || null,
    hot: one(params, "hot") === "1",
  });
  const today = moscowToday();
  const visible = one(params, "side") === "client" ? items.filter((item) => !["done", "cancelled"].includes(item.status)) : items;
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Записи</h1>
          <p className="lead">Задачи проектов и пункты бэклога в выбранном срезе.</p>
        </div>
      </header>
      {visible.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Номер</th><th>Описание</th><th>Где</th><th>Ответственный</th><th>Сторона / для кого</th><th>Срок</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className={item.attention}>
                  <td><Link href={`/tasks/${item.number}`}>{item.number}</Link></td>
                  <td>{item.description}</td>
                  <td>{item.projectNumber ? <Link href={`/projects/${item.projectNumber}`}>{item.projectName}</Link> : item.productName}</td>
                  <td>{item.assignee}</td>
                  <td>{item.kind === "project_task" ? sideLabel(item.side) : beneficiaryLabel(item.beneficiary, item.clientName)}</td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td><Mark attention={item.attention} due={item.dueDate} today={today} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty">В этом срезе записей нет.</div>
      )}
    </>
  );
}
