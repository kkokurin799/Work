export class InputError extends Error {
  fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super(Object.values(fields).join(" "));
    this.name = "InputError";
    this.fields = fields;
  }
}

export class AuthError extends Error {
  constructor() {
    super("Нужно войти.");
    this.name = "AuthError";
  }
}
