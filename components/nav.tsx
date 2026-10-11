"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UsersRound,
  KanbanSquare,
  ListTodo,
  Scale,
  Cable,
  ShieldCheck,
} from "lucide-react";
const icons = {
  dashboard: LayoutDashboard,
  clients: UsersRound,
  commercial: KanbanSquare,
  tasks: ListTodo,
  publications: Scale,
  integrations: Cable,
  audit: ShieldCheck,
};
export function Nav({
  items,
}: {
  items: { href: string; label: string; icon: keyof typeof icons }[];
}) {
  const path = usePathname();
  return (
    <nav aria-label="Menu principal">
      {items.map((item) => {
        const Icon = icons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              (item.href === "/" ? path === "/" : path.startsWith(item.href))
                ? "selected"
                : ""
            }
          >
            <Icon size={19} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
