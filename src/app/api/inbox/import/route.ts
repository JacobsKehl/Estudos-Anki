import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Importação local não disponível na Web." }, { status: 403 });
}
