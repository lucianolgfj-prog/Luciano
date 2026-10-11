import Link from "next/link";
import { Bell, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { actor } from "@/lib/auth";
import { permissions } from "@/lib/policy";
import { labels } from "@/lib/format";
import { Nav } from "./nav";
import { Logout } from "./auth-buttons";
export async function Shell({ children }: { children: ReactNode }) {
  const user = await actor();
  const items: {
    href: string;
    label: string;
    icon:
      | "dashboard"
      | "clients"
      | "commercial"
      | "tasks"
      | "publications"
      | "integrations"
      | "audit";
  }[] = [
    { href: "/", label: "Visão geral", icon: "dashboard" },
    { href: "/clientes", label: "Clientes", icon: "clients" },
    ...(permissions.finance(user.role)
      ? [
          {
            href: "/comercial",
            label: "Comercial",
            icon: "commercial",
          } as const,
        ]
      : []),
    { href: "/controladoria", label: "Controladoria", icon: "tasks" },
    ...(permissions.publications(user.role)
      ? [
          {
            href: "/publicacoes",
            label: "Publicações",
            icon: "publications",
          } as const,
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [
          {
            href: "/integracoes",
            label: "Integrações",
            icon: "integrations",
          } as const,
          { href: "/auditoria", label: "Auditoria", icon: "audit" } as const,
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="monogram">
            JDA<span>■</span>
          </span>
          <span>GESTÃO INTEGRADA</span>
        </Link>
        <div className="workspace">
          <span className="workspace-dot" />
          TRIBUTÁRIO <span className="workspace-tag">JDA</span>
        </div>
        <p className="nav-label">ESCRITÓRIO</p>
        <Nav items={items} />
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={17} />
            <span>
              Ambiente {user.isDemo ? "de demonstração" : "restrito"}
              <small>
                {user.localAccess
                  ? "Entrada local direta como Luciano"
                  : "Controle de acesso ativo"}
              </small>
            </span>
          </div>
          <div className="profile">
            <div className="avatar">{user.name[0]}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{labels[user.role]}</small>
            </div>
            {!user.localAccess && <Logout />}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            João Domingos Advogados <span className="top-divider">/</span> Área
            tributária
          </span>
          <div>
            <Link className="top-search" href="/clientes">
              <Search size={16} />
              Buscar cliente
            </Link>
            {permissions.publications(user.role) && (
              <Link
                href="/publicacoes"
                aria-label="Publicações aguardando revisão"
                className="notification"
              >
                <Bell size={19} />
              </Link>
            )}
            <span className="mobile-logout">
              {!user.localAccess && <Logout />}
            </span>
            <span className="avatar small-avatar">{user.name[0]}</span>
          </div>
        </header>
        {user.isDemo && (
          <div className="demo-banner">
            <span className="dot" />
            DEMONSTRAÇÃO{" "}
            <span>Dados sintéticos · integrações reais desativadas</span>
          </div>
        )}
        <main className="content">{children}</main>
        <footer className="app-footer">
          JDA Gestão Integrada{" "}
          <span>
            Conferência humana obrigatória para providências e prazos jurídicos.
          </span>
        </footer>
      </div>
    </div>
  );
}
