import { LoginButtons } from "@/components/auth-buttons";
import { demoMode } from "@/lib/policy";
export const dynamic = "force-dynamic";
export default function Login() {
  const demo = demoMode() && process.env.DEMO_LOGIN_ENABLED === "true";
  return (
    <main className="login-page">
      <section className="login-brand">
        <span className="login-monogram">
          JDA<span>■</span>
        </span>
        <p className="eyebrow">JOÃO DOMINGOS ADVOGADOS</p>
        <h1>
          Uma visão integrada.
          <br />
          Uma gestão mais precisa.
        </h1>
        <p>
          Comercial, controladoria e execução jurídica conectados em um só
          ambiente.
        </p>
        <div className="login-rule" />
        <small>GESTÃO INTEGRADA · ÁREA TRIBUTÁRIA</small>
      </section>
      <section className="login-card">
        <span className="badge">
          {demo ? "DEMONSTRAÇÃO" : "ACESSO RESTRITO"}
        </span>
        <h2>Bem-vindo ao escritório</h2>
        <p>
          {demo
            ? "Escolha um perfil para explorar os fluxos e permissões."
            : "Use sua conta profissional autorizada pelo administrador."}
        </p>
        <LoginButtons demo={demo} configured={!!process.env.ENTRA_CLIENT_ID} />
      </section>
    </main>
  );
}
