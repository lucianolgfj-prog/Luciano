import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { authOptions } from "./auth-options";
import { db } from "./db";
import { demoMode } from "./policy";
import { localDemoBypassAllowed } from "./local-demo";
export async function actor() {
  if (localDemoBypassAllowed((await headers()).get("host"))) {
    const user = await db.user.findUnique({ where: { id: "demo-luciano" } });
    if (!user?.active || !user.isDemo || user.role !== "ADMIN")
      throw new Error(
        "Usuário local de demonstração indisponível. Execute npm run db:seed no modo demo.",
      );
    return { ...user, localAccess: true };
  }
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id } });
  if (!user?.active || user.isDemo !== demoMode()) redirect("/login");
  return { ...user, localAccess: false };
}
export async function admin() {
  const user = await actor();
  if (user.role !== "ADMIN") throw new Error("Permissão insuficiente.");
  return user;
}
