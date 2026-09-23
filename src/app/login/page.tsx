import { loginAction } from "@/server/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  return (
    <main className="main" style={{ maxWidth: 460, margin: "10vh auto" }}>
      <h1>Work</h1>
      <p className="lead">Вход в контур проектов и сроков.</p>
      {error ? <div className="banner" style={{ marginTop: 16 }}>{error}</div> : null}
      <form action={loginAction} className="panel stack" style={{ marginTop: 16 }}>
        <label className="field">
          Почта
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          Пароль
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="primary" type="submit">Войти</button>
      </form>
    </main>
  );
}
