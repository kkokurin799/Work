import type { Filters } from "./records";

type Search = Record<string, string | string[] | undefined>;

export function one(search: Search, key: string): string {
  const value = search[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function readFilters(search: Search): Filters {
  return {
    teamId: uuid(one(search, "team")),
    productId: uuid(one(search, "product")),
    clientId: uuid(one(search, "client")),
    dueOnOrBefore: date(one(search, "due")),
  };
}

export function filterQuery(filters: Filters, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.teamId) params.set("team", filters.teamId);
  if (filters.productId) params.set("product", filters.productId);
  if (filters.clientId) params.set("client", filters.clientId);
  if (filters.dueOnOrBefore) params.set("due", filters.dueOnOrBefore);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function uuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function date(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
