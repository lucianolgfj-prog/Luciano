import type { Role } from "@prisma/client";
export const demoMode = () => process.env.APP_MODE === "demo";
export const permissions = {
  clients: (role: Role) => role === "ADMIN" || role === "COMMERCIAL",
  finance: (role: Role) => role === "ADMIN" || role === "COMMERCIAL",
  publications: (role: Role) => role === "ADMIN" || role === "LEGAL",
  approve: (role: Role) => role === "ADMIN",
  integrations: (role: Role) => role === "ADMIN",
};
export function canUpdateTask(
  actor: { id: string; role: Role },
  task: { assigneeId: string },
) {
  return actor.role === "ADMIN" || actor.id === task.assigneeId;
}
export function externalWritesAllowed() {
  return (
    process.env.APP_MODE === "production" &&
    process.env.ALLOW_EXTERNAL_WRITES === "true"
  );
}
