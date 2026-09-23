import { Suspense } from "react";
import { Chrome } from "@/components/chrome";
import { listCatalog } from "@/server/catalog";
import { requireUser } from "@/server/current";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [teams, products, clients] = await Promise.all([
    listCatalog("teams"),
    listCatalog("products"),
    listCatalog("clients"),
  ]);
  return (
    <Suspense>
      <Chrome email={user.email} teams={teams} products={products} clients={clients}>
        {children}
      </Chrome>
    </Suspense>
  );
}
