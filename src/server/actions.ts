"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate } from "./auth";
import { createCatalog, createPerson, updateCatalog, updatePerson, type CatalogKind } from "./catalog";
import { editor, sessionCookie } from "./current";
import { InputError } from "./errors";
import { applyInboundForm, rejectInbound } from "./inbox";
import { signSession } from "./session";
import { createProject, createTask, updateProject, updateTask, type ProjectInput, type TaskInput } from "./records";

export async function loginAction(formData: FormData): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) redirect("/login?error=" + encodeURIComponent("SESSION_SECRET не задан."));
  try {
    const user = await authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    const jar = await cookies();
    const cookie = sessionCookie(signSession(user.id, secret));
    jar.set(cookie.name, cookie.value, cookie.options);
  } catch (error) {
    redirect("/login?error=" + encodeURIComponent(error instanceof InputError ? error.message : "Не удалось войти."));
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(sessionCookie("").name);
  redirect("/login");
}

export async function createProjectAction(formData: FormData): Promise<void> {
  const user = await editor();
  const back = String(formData.get("return") || "/projects");
  try {
    const project = await createProject(projectInput(formData), user.id);
    redirect(`/projects/${project.number}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError(back, error));
  }
}

export async function updateProjectAction(formData: FormData): Promise<void> {
  const user = await editor();
  const number = String(formData.get("number") ?? "");
  try {
    await updateProject(number, projectInput(formData), user.id);
    redirect(`/projects/${String(formData.get("nextNumber") || number)}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError(`/projects/${number}`, error));
  }
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const user = await editor();
  const back = String(formData.get("return") || "/backlog");
  try {
    const task = await createTask(taskInput(formData), user.id);
    redirect(`/tasks/${task.number}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError(back, error));
  }
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const user = await editor();
  const number = String(formData.get("number") ?? "");
  try {
    const task = await updateTask(number, taskInput(formData), user.id);
    redirect(`/tasks/${task.number}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError(`/tasks/${number}`, error));
  }
}

export async function createCatalogAction(formData: FormData): Promise<void> {
  await editor();
  const kind = String(formData.get("kind") ?? "") as CatalogKind | "people";
  try {
    if (kind === "people") await createPerson(String(formData.get("name") ?? ""), empty(formData.get("teamId")));
    else if (kind === "products" || kind === "clients" || kind === "teams") await createCatalog(kind, String(formData.get("name") ?? ""));
    else throw new InputError({ kind: "Неизвестный справочник." });
    redirect("/catalog");
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError("/catalog", error));
  }
}

export async function archiveCatalogAction(formData: FormData): Promise<void> {
  await editor();
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (kind === "people") await updatePerson(id, { archived });
  else if (kind === "products" || kind === "clients" || kind === "teams") await updateCatalog(kind, id, { archived });
  redirect("/catalog");
}

export async function rejectInboundAction(formData: FormData): Promise<void> {
  await editor();
  await rejectInbound(String(formData.get("id") ?? ""));
  redirect("/inbox");
}

export async function applyInboundAction(formData: FormData): Promise<void> {
  const user = await editor();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("recordKind") ?? "");
  try {
    const number =
      kind === "project"
        ? await applyInboundForm(id, projectInput(formData), user.id)
        : await applyInboundForm(id, taskInput(formData), user.id);
    redirect(kind === "project" ? `/projects/${number}` : `/tasks/${number}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(withError(`/inbox/${id}`, error));
  }
}

function projectInput(formData: FormData): ProjectInput {
  return {
    name: String(formData.get("name") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
    status: String(formData.get("status") ?? "") || undefined,
    dueDate: String(formData.get("dueDate") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    number: String(formData.get("nextNumber") ?? "") || undefined,
  };
}

function taskInput(formData: FormData): TaskInput {
  const kind = String(formData.get("recordKind") ?? "backlog") === "project_task" ? "project_task" : "backlog";
  return {
    kind,
    description: String(formData.get("description") ?? ""),
    assigneeName: String(formData.get("assigneeName") ?? ""),
    teamId: empty(formData.get("teamId")),
    status: String(formData.get("status") ?? "") || undefined,
    dueDate: String(formData.get("dueDate") ?? ""),
    externalNumber: String(formData.get("externalNumber") ?? ""),
    projectNumber: String(formData.get("projectNumber") ?? ""),
    side: String(formData.get("side") ?? "") || null,
    productId: empty(formData.get("productId")),
    beneficiary: String(formData.get("beneficiary") ?? "") || null,
    clientId: empty(formData.get("clientId")),
  };
}

function empty(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function withError(path: string, error: unknown): string {
  const message = error instanceof InputError ? error.message : "Не получилось сохранить запись.";
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}error=${encodeURIComponent(message)}`;
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
