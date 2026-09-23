"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/server/actions";

type Option = { id: string; name: string };

const LINKS = [
  ["/", "Обзор"],
  ["/projects", "Проекты"],
  ["/backlog", "Бэклог"],
  ["/inbox", "Входящие"],
  ["/catalog", "Справочники"],
];

export function Chrome({
  email,
  teams,
  products,
  clients,
  children,
}: {
  email: string;
  teams: Option[];
  products: Option[];
  clients: Option[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const error = search.get("error");

  function href(path: string) {
    return query ? `${path}?${query}` : path;
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (String(value)) next.set(key, String(value));
    }
    window.location.href = next.toString() ? `${pathname}?${next}` : pathname;
  }

  return (
    <div className="app">
      <aside className="side">
        <Link className="brand" href={href("/")}>
          Work
          <span>контур сроков</span>
        </Link>
        <nav className="nav">
          {LINKS.map(([path, title]) => (
            <Link key={path} href={href(path)} className={pathname === path ? "active" : ""}>
              {title}
            </Link>
          ))}
        </nav>
        <div className="who">
          {email}
          <form action={logoutAction}>
            <button type="submit">Выйти</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <form className="filters" key={query} onSubmit={submit}>
          <Select label="Команда" name="team" value={search.get("team") ?? ""} options={teams} />
          <Select label="Продукт" name="product" value={search.get("product") ?? ""} options={products} />
          <Select label="Клиент" name="client" value={search.get("client") ?? ""} options={clients} />
          <label>
            Контрольная дата
            <input name="due" type="date" defaultValue={search.get("due") ?? ""} />
          </label>
          <button type="submit">Показать</button>
          <a className="ghost" href={pathname} style={{ textDecoration: "none" }}>
            Сбросить
          </a>
        </form>
        {error ? <div className="banner">{error}</div> : null}
        {children}
      </div>
    </div>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: Option[] }) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        <option value="">Все</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
