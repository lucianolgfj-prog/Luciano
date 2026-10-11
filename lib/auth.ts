import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth-options";
import { db } from "./db";
import { demoMode } from "./policy";
export async function actor() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) redirect("/login");
  const user = await db.user.findUnique({ where: { id } });
  if (!user?.active || user.isDemo !== demoMode()) redirect("/login");
  return user;
}
export async function admin() {
  const user = await actor();
  if (user.role !== "ADMIN") throw new Error("Permissão insuficiente.");
  return user;
}
