"use client";
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { LogOut, ArrowRight } from "lucide-react";
export function Logout() {
  return (
    <button
      className="logout"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut size={16} />
      Sair
    </button>
  );
}
export function LoginButtons({
  demo,
  configured,
}: {
  demo: boolean;
  configured: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function enter(email: string) {
    setBusy(true);
    setError("");
    try {
      const r = await signIn("demo", { email, redirect: false });
      if (r?.error) {
        setError("Não foi possível entrar. Verifique o banco e o seed.");
        setBusy(false);
      } else location.assign("/");
    } catch {
      setError("Serviço indisponível. Tente novamente.");
      setBusy(false);
    }
  }
  return (
    <div className="login-buttons">
      {demo ? (
        <>
          {["Luciano", "Rafael", "Gustavo"].map((name, i) => (
            <button
              disabled={busy}
              key={name}
              onClick={() => enter(`${name.toLowerCase()}@demo.jda.test`)}
            >
              <span>
                <strong>{name}</strong>
                <small>
                  {
                    [
                      "Administrador · gestão e aprovação",
                      "Comercial · clientes e propostas",
                      "Jurídico · execução e processos",
                    ][i]
                  }
                </small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
          <p className="muted">
            Acesso sem senha apenas na demonstração. Nunca habilite este modo
            para dados reais ou acesso público.
          </p>
        </>
      ) : (
        <>
          <button
            disabled={!configured || busy}
            className="primary"
            onClick={() => {
              setBusy(true);
              signIn("azure-ad", { callbackUrl: "/" });
            }}
          >
            Entrar com Microsoft <ArrowRight size={18} />
          </button>
          {!configured && (
            <p>Login Entra ID ainda não configurado no servidor.</p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </div>
  );
}
