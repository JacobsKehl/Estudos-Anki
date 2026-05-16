import { NextResponse } from "next/server";

export async function GET() {
  // Rota desativada na Web para reduzir tamanho do bundle
  return NextResponse.json({ 
    inboxDir: "Modo Nuvem Ativo",
    files: [],
    message: "A Inbox local só está disponível rodando o app no seu computador."
  });
}
