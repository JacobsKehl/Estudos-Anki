import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST() {
  const inboxDir = process.env.PDF_INBOX_DIR;

  if (!inboxDir) {
    return NextResponse.json({ error: "PDF_INBOX_DIR não configurado" }, { status: 500 });
  }

  // No Windows, usamos o comando 'explorer' para abrir a pasta
  // É importante limpar e validar o caminho para evitar injeção de comandos
  // Como é uma aplicação local para uso pessoal, o risco é controlado, mas a boa prática permanece.
  
  const cleanPath = inboxDir.replace(/"/g, "");

  exec(`explorer "${cleanPath}"`, (error) => {
    if (error) {
      console.error("Erro ao abrir pasta:", error);
    }
  });

  return NextResponse.json({ success: true });
}
