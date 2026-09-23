import { NextResponse } from "next/server";
import { editorOrError, guard, jsonError, notFound } from "./api";
import { createCatalog, listCatalog, updateCatalog, type CatalogKind } from "./catalog";

export function catalogCollection(kind: CatalogKind) {
  return {
    async GET(request: Request) {
      const auth = await guard();
      if (auth.error || !auth.user) return auth.error;
      const archived = new URL(request.url).searchParams.get("archived") === "1";
      return NextResponse.json({ items: await listCatalog(kind, archived) });
    },
    async POST(request: Request) {
      const auth = await editorOrError();
      if (auth.error || !auth.user) return auth.error;
      try {
        const body = await request.json();
        return NextResponse.json(await createCatalog(kind, String(body.name ?? "")), { status: 201 });
      } catch (error) {
        return jsonError(error);
      }
    },
  };
}

export function catalogItem(kind: CatalogKind) {
  return {
    async PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
      const auth = await editorOrError();
      if (auth.error || !auth.user) return auth.error;
      try {
        const { id } = await context.params;
        const body = await request.json();
        await updateCatalog(kind, id, { name: body.name, archived: body.archived });
        const items = await listCatalog(kind, true);
        const item = items.find((row) => row.id === id);
        if (!item) return notFound();
        return NextResponse.json(item);
      } catch (error) {
        return jsonError(error);
      }
    },
  };
}
