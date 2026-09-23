import Link from "next/link";
import { Mark, NamedSelect, StatusSelect, formatDate } from "@/components/bits";
import { moscowToday } from "@/domain/dates";
import { label, PROJECT_STATUSES } from "@/domain/labels";
import { createProjectAction } from "@/server/actions";
import { listCatalog } from "@/server/catalog";
import { one, readFilters } from "@/server/params";
import { listProjects } from "@/server/records";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  const lifecycle = one(params, "lifecycle");
  const [projects, products, clients, teams] = await Promise.all([
    listProjects(filters, lifecycle || null),
    listCatalog("products"),
    listCatalog("clients"),
    listCatalog("teams"),
  ]);
  const today = moscowToday();
  const filtered = Boolean(filters.teamId || filters.productId || filters.clientId || filters.dueOnOrBefore || lifecycle);
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Проекты</h1>
          <p className="lead">Запуски продуктов у клиентов и задачи внутри них.</p>
        </div>
      </header>
      {projects.length ? (
        <div className="cards">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.number}`} className={`card ${project.attention}`}>
              <div className="card-top">
                <span className="kicker">{project.number} · {label(PROJECT_STATUSES, project.status)}</span>
                <Mark attention={project.attention} due={project.nearestDue ?? project.dueDate} today={today} />
              </div>
              <h2>{project.name}</h2>
              <div className="meta">
                <span>{project.productName}</span>
                <span>{project.clientName}</span>
                <span>{project.teamName}</span>
                <span>срок проекта {formatDate(project.dueDate)}</span>
                <span>{project.openCount} открытых</span>
                <span>{project.clientSideCount} на стороне клиента</span>
                <span>ближайшая задача {formatDate(project.nearestDue)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="panel empty">
          {filtered ? "По этому фильтру проектов нет." : "Проектов пока нет. Заведите запуск ниже или пришлите сообщение со строкой ПРОЕКТ."}{" "}
          {filtered ? <a href="/projects">Сбросить фильтр</a> : null}
        </div>
      )}
      <details className="section">
        <summary>Новый проект</summary>
        <form action={createProjectAction} className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="return" value="/projects" />
          <label className="field wide">Название<input name="name" required /></label>
          <NamedSelect labelText="Продукт" name="productId" rows={products} />
          <NamedSelect labelText="Клиент" name="clientId" rows={clients} />
          <NamedSelect labelText="Команда" name="teamId" rows={teams} />
          <StatusSelect kind="project" value="preparing" />
          <label className="field">Срок<input name="dueDate" type="date" /></label>
          <label className="field wide">Кратко<textarea name="summary" /></label>
          <button className="primary" type="submit">Записать проект</button>
        </form>
      </details>
    </>
  );
}
