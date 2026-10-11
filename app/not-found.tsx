import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <h1>Registro não encontrado</h1>
      <p>O endereço não existe ou não está disponível para este ambiente.</p>
      <Link href="/clientes">Voltar aos clientes</Link>
    </main>
  );
}
