"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="standalone">
      <h1>Não foi possível concluir a operação</h1>
      <p>
        Verifique os campos, suas permissões e se o registro já foi alterado.
        Acesse Integrações para falhas de sincronização. Se persistir, consulte
        os logs do servidor.
      </p>
      <button onClick={reset}>Tentar novamente</button>
      <Link href="/">Voltar ao painel</Link>
    </main>
  );
}
