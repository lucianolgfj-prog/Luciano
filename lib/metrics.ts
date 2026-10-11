export type Recurring = {
  monthlyFee: number;
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
};
export function recurringAt(services: Recurring[], at: Date) {
  return services
    .filter((s) => s.startsAt <= at && (!s.endsAt || s.endsAt > at))
    .reduce((sum, s) => sum + s.monthlyFee, 0);
}
export function conversion(stages: string[]) {
  const closed = stages.filter((s) => s === "WON" || s === "LOST");
  return closed.length
    ? Math.round(
        (100 * closed.filter((s) => s === "WON").length) / closed.length,
      )
    : 0;
}
