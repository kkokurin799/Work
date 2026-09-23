import { NextResponse } from "next/server";
import { guard, jsonError } from "@/server/api";
import { overview } from "@/server/overview";
import { readFilters } from "@/server/params";

export async function GET(request: Request) {
  const auth = await guard();
  if (auth.error || !auth.user) return auth.error;
  try {
    const url = new URL(request.url);
    const filters = readFilters(Object.fromEntries(url.searchParams.entries()));
    return NextResponse.json(await overview(filters));
  } catch (error) {
    return jsonError(error);
  }
}
