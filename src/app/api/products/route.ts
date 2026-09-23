import { catalogCollection } from "@/server/catalog-http";

const handlers = catalogCollection("products");
export const GET = handlers.GET;
export const POST = handlers.POST;
