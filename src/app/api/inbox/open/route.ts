import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Comando não disponível na Web." }, { status: 403 });
}
