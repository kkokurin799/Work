import Link from "next/link";
import { Mark } from "@/components/bits";
import { formatDate, formatStamp, moscowToday } from "@/domain/dates";
import { filterQuery, one, readFilters } from "@/server/params";
import { overview } from "@/server/overview";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const data = await overview(filters);
  const today = moscowToday();
  const query = filterQuery(filters);
  const counters = [
    ["Проекты в работе", data.projectsLive, `/projects${filterQuery(filters, { lifecycle: "open" })}`],
    ["На стороне клиента", data.clientSide, `/tasks${filterQuery(filters, { side: "client" })}`],
    ["Горит", data.soon, `/tasks${filterQuery(filters, { attention: "soon" })}`],
    ["Просрочено", data.overdue, `/tasks${filterQuery(filters, { attention: "overdue" })}`],
    ["В спринте", data.inSprint, `/backlog${filterQuery(filters, { status: "in_sprint" })}`],
    ["Без срока", data.undated, `/tasks${filterQuery(filters, { attention: "undated" })}`],
    ["Входящие", data.inbox, "/inbox?status=needs_review"],
  ];
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Обзор</h1>
          <p className="lead">Что сейчас в запуске и какие сроки уже близко.</p>
        </div>
      </header>
      {data.failedDeliveries > 0 ? (
        <div className="banner">Оповещения не уходят: {data.failedDeliveries} за последние сутки. Напишите боту, если чат ещё не привязан.</div>
      ) : null}
      <div className="counters">
        {counters.map(([title, value, href]) => (
          <Link key={title} className="counter" href={String(href)}>
            <b>{value}</b>
            <span>{title}</span>
          </Link>
        ))}
      </div>
      <section className="section">
        <div className="row-top">
          <h2>Горит и просрочено</h2>
          <Link href={`/tasks${filterQuery(filters, { hot: "1" })}`}>все</Link>
        </div>
        {data.attention.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Номер</th><th>Суть</th><th>Срок</th><th>Ответственный</th><th></th></tr>
              </thead>
              <tbody>
                {data.attention.map((item) => (
                  <tr key={item.id} className={item.attention}>
                    <td><Link href={`/tasks/${item.number}`}>{item.number}</Link></td>
                    <td>{item.description}</td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{item.assignee}</td>
                    <td><Mark attention={item.attention} due={item.dueDate} today={today} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel empty">В выбранном срезе нет горящих и просроченных записей.</div>
        )}
        <p className="lead">
          {data.lastDigestAt ? `Последняя сводка: ${formatStamp(data.lastDigestAt)}.` : "Утренняя сводка ещё не уходила."} {one(params, "due") ? `Контрольная дата ${formatDate(one(params, "due"))}.` : ""}
        </p>
        <p className="lead"><Link href={`/tasks${query}`}>Открыть задачи этого среза</Link></p>
      </section>
    </>
  );
}
