import { archiveCatalogAction, createCatalogAction } from "@/server/actions";
import { listCatalog, listPeople } from "@/server/catalog";
import { NamedSelect } from "@/components/bits";

export default async function CatalogPage() {
  const [products, clients, teams, people] = await Promise.all([
    listCatalog("products", true),
    listCatalog("clients", true),
    listCatalog("teams", true),
    listPeople(true),
  ]);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Справочники</h1>
          <p className="lead">Продукты, клиенты, команды и люди. Архив скрывает запись из выбора и сохраняет историю.</p>
        </div>
      </header>
      <div className="cards">
        <CatalogBlock title="Продукты" kind="products" rows={products} />
        <CatalogBlock title="Клиенты" kind="clients" rows={clients} />
        <CatalogBlock title="Команды" kind="teams" rows={teams} />
        <section className="panel">
          <h2>Люди</h2>
          <ul>
            {people.map((person) => (
              <li key={person.id}>
                {person.name} {person.teamName ? `· ${person.teamName}` : ""} {person.archivedAt ? "· в архиве" : ""}
                <form action={archiveCatalogAction} style={{ display: "inline" }}>
                  <input type="hidden" name="kind" value="people" />
                  <input type="hidden" name="id" value={person.id} />
                  <input type="hidden" name="archived" value={person.archivedAt ? "false" : "true"} />
                  <button className="ghost" type="submit">{person.archivedAt ? "Вернуть" : "В архив"}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={createCatalogAction} className="form-grid">
            <input type="hidden" name="kind" value="people" />
            <label className="field">Имя<input name="name" required /></label>
            <NamedSelect labelText="Команда" name="teamId" rows={teams.filter((team) => !team.archivedAt)} empty="Без команды" />
            <button className="primary" type="submit">Добавить</button>
          </form>
        </section>
      </div>
    </>
  );
}

function CatalogBlock({ title, kind, rows }: { title: string; kind: string; rows: { id: string; name: string; archivedAt: string | null }[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {row.name} {row.archivedAt ? "· в архиве" : ""}
            <form action={archiveCatalogAction} style={{ display: "inline" }}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="archived" value={row.archivedAt ? "false" : "true"} />
              <button className="ghost" type="submit">{row.archivedAt ? "Вернуть" : "В архив"}</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={createCatalogAction} className="stack">
        <input type="hidden" name="kind" value={kind} />
        <label className="field">Имя<input name="name" required /></label>
        <button className="primary" type="submit">Добавить</button>
      </form>
    </section>
  );
}
