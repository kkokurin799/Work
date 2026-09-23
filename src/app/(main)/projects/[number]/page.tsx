import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Mark, NamedSelect, StatusSelect, formatDate, sideLabel } from "@/components/bits";
import { label, PROJECT_STATUSES, TASK_STATUSES } from "@/domain/labels";
import { moscowToday } from "@/domain/dates";
import { createTaskAction, updateProjectAction } from "@/server/actions";
import { listCatalog, listPeople } from "@/server/catalog";
import { projectActivity, getProject } from "@/server/records";

export default async function ProjectPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const project = await getProject(decodeURIComponent(number));
  if (!project) notFound();
  const [products, clients, teams, people, activity] = await Promise.all([
    listCatalog("products"),
    listCatalog("clients"),
    listCatalog("teams"),
    listPeople(),
    projectActivity(project.id),
  ]);
  const today = moscowToday();
  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker"><Link href="/projects">Проекты</Link> / {project.number}</p>
          <h1>{project.name}</h1>
          <p className="lead">
            {label(PROJECT_STATUSES, project.status)} · {project.productName} · {project.clientName} · {project.teamName} · срок {formatDate(project.dueDate)}
          </p>
        </div>
        <Mark attention={project.attention} due={project.nearestDue ?? project.dueDate} today={today} />
      </header>
      <div className="meta" style={{ marginBottom: 16 }}>
        <span>{project.openCount} открытых задач</span>
        <span>{project.clientSideCount} на стороне клиента</span>
        <span>ближайший срок {formatDate(project.nearestDue)}</span>
      </div>
      {project.summary ? <p>{project.summary}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Номер</th><th>Описание</th><th>Ответственный</th><th>Сторона</th><th>Статус</th><th>Команда</th><th>Срок</th><th></th>
            </tr>
          </thead>
          <tbody>
            {project.tasks.map((task) => (
              <tr key={task.id} className={task.attention}>
                <td><Link href={`/tasks/${task.number}`}>{task.number}</Link></td>
                <td>{task.description}{task.externalNumber ? <div className="kicker">{task.externalNumber}</div> : null}</td>
                <td>{task.assignee}</td>
                <td>{sideLabel(task.side)}</td>
                <td>{label(TASK_STATUSES, task.status)}</td>
                <td>{task.teamName}</td>
                <td>{formatDate(task.dueDate)}</td>
                <td><Mark attention={task.attention} due={task.dueDate} today={today} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {project.tasks.length ? null : <div className="empty">В проекте пока нет задач.</div>}
      </div>
      <div className="grid-2 section">
        <details open>
          <summary>Задача в этот проект</summary>
          <form action={createTaskAction} className="form-grid" style={{ marginTop: 12 }}>
            <input type="hidden" name="return" value={`/projects/${project.number}`} />
            <input type="hidden" name="recordKind" value="project_task" />
            <input type="hidden" name="projectNumber" value={project.number} />
            <label className="field wide">Описание<textarea name="description" required /></label>
            <label className="field">Ответственный
              <input name="assigneeName" list="people" required />
            </label>
            <label className="field">Сторона
              <select name="side" defaultValue="ours">
                <option value="ours">Мы</option>
                <option value="client">Клиент</option>
                <option value="partner">Партнёр</option>
              </select>
            </label>
            <NamedSelect labelText="Команда" name="teamId" rows={teams} value={project.teamId} />
            <StatusSelect kind="task" value="todo" />
            <label className="field">Срок<input name="dueDate" type="date" defaultValue={project.dueDate ?? ""} /></label>
            <label className="field">Внешний номер<input name="externalNumber" /></label>
            <button className="primary" type="submit">Добавить задачу</button>
          </form>
          <datalist id="people">{people.map((person) => <option key={person.id} value={person.name} />)}</datalist>
        </details>
        <details>
          <summary>Править проект</summary>
          <form action={updateProjectAction} className="stack" style={{ marginTop: 12 }}>
            <input type="hidden" name="number" value={project.number} />
            <label className="field">Номер<input name="nextNumber" defaultValue={project.number} /></label>
            <label className="field">Название<input name="name" defaultValue={project.name} /></label>
            <NamedSelect labelText="Продукт" name="productId" rows={products} value={project.productId} />
            <NamedSelect labelText="Клиент" name="clientId" rows={clients} value={project.clientId} />
            <NamedSelect labelText="Команда" name="teamId" rows={teams} value={project.teamId} />
            <StatusSelect kind="project" value={project.status} />
            <label className="field">Срок<input name="dueDate" type="date" defaultValue={project.dueDate ?? ""} /></label>
            <label className="field">Кратко<textarea name="summary" defaultValue={project.summary ?? ""} /></label>
            <button className="primary" type="submit">Сохранить</button>
          </form>
        </details>
      </div>
      <section className="section">
        <h2>История</h2>
        <History items={activity} />
      </section>
    </>
  );
}
