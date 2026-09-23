import Link from "next/link";
import { Mark, NamedSelect, StatusSelect, beneficiaryLabel, formatDate } from "@/components/bits";
import { moscowToday } from "@/domain/dates";
import { BACKLOG_STATUSES, label } from "@/domain/labels";
import { createTaskAction } from "@/server/actions";
import { listCatalog, listPeople } from "@/server/catalog";
import { one, readFilters } from "@/server/params";
import { listTasks } from "@/server/records";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const status = one(params, "status");
  const [items, products, teams, clients, people] = await Promise.all([
    listTasks({ ...filters, kind: "backlog", status: status || null }),
    listCatalog("products"),
    listCatalog("teams"),
    listCatalog("clients"),
    listPeople(),
  ]);
  const today = moscowToday();
  const filtered = Boolean(filters.teamId || filters.productId || filters.clientId || filters.dueOnOrBefore || status);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Бэклог</h1>
          <p className="lead">Развитие продуктов: что обещано, что уже в спринте и к какой дате.</p>
        </div>
      </header>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Номер</th><th>Описание</th><th>Команда</th><th>Ответственный</th><th>Статус</th><th>Для кого</th><th>Срок</th><th>Продукт</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.attention}>
                  <td><Link href={`/tasks/${item.number}`}>{item.number}</Link>{item.externalNumber ? <div className="kicker">{item.externalNumber}</div> : null}</td>
                  <td>{item.description}</td>
                  <td>{item.teamName}</td>
                  <td>{item.assignee}</td>
                  <td>{label(BACKLOG_STATUSES, item.status)}</td>
                  <td>{beneficiaryLabel(item.beneficiary, item.clientName)}</td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td>{item.productName}</td>
                  <td><Mark attention={item.attention} due={item.dueDate} today={today} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty">
          {filtered ? "По этому фильтру пунктов нет." : "Бэклог пуст. Добавьте пункт формой или сообщением со строкой БЭКЛОГ."}{" "}
          {filtered ? <a href="/backlog">Сбросить фильтр</a> : null}
        </div>
      )}
      <details className="section">
        <summary>Новый пункт бэклога</summary>
        <form action={createTaskAction} className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="return" value="/backlog" />
          <input type="hidden" name="recordKind" value="backlog" />
          <NamedSelect labelText="Продукт" name="productId" rows={products} />
          <label className="field wide">Описание<textarea name="description" required /></label>
          <NamedSelect labelText="Команда" name="teamId" rows={teams} />
          <label className="field">Ответственный<input name="assigneeName" list="people" required /></label>
          <label className="field">Для кого
            <select name="beneficiary" defaultValue="client">
              <option value="client">Конкретный клиент</option>
              <option value="all_clients">Все клиенты</option>
              <option value="internal">Внутреннее</option>
            </select>
          </label>
          <NamedSelect labelText="Клиент" name="clientId" rows={clients} empty="Не выбран" />
          <StatusSelect kind="backlog" value="backlog" />
          <label className="field">Срок<input name="dueDate" type="date" /></label>
          <label className="field">Внешний номер<input name="externalNumber" /></label>
          <button className="primary" type="submit">Записать в бэклог</button>
        </form>
        <datalist id="people">{people.map((person) => <option key={person.id} value={person.name} />)}</datalist>
      </details>
    </>
  );
}
