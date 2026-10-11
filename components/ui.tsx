import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
import { labels } from "@/lib/format";
export function Badge({
  value,
  late = false,
}: {
  value: string;
  late?: boolean;
}) {
  return (
    <span className={`badge ${late ? "late" : value.toLowerCase()}`}>
      {late ? "Atrasada" : (labels[value] ?? value)}
    </span>
  );
}
export function Panel({
  title,
  caption,
  children,
  href,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  href?: string;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {caption && <p>{caption}</p>}
        </div>
        {href && (
          <Link className="text-link" href={href}>
            Ver todos <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  text = "Nenhum registro encontrado.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={26} />
      <p>{text}</p>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {children}
    </div>
  );
}
