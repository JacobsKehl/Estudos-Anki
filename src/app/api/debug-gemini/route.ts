import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { identifySubject } from "@/lib/ai/organizer";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY is not defined in Vercel environment variables."
      });
    }

    // Carregar o Direito Civil (1).pdf do banco
    const material = await prisma.studyMaterial.findUnique({
      where: { id: "cmpah8enm0001jj04623eqhn4" },
      include: {
        extractedContent: {
          orderBy: { pageNumber: "asc" },
          take: 3
        }
      }
    });

    if (!material) {
      return NextResponse.json({
        success: false,
        error: "Material Direito Civil (1).pdf not found in database."
      });
    }

    const sampleText = material.extractedContent.map(p => p.text).join("\n\n");
    const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;

    console.log(`[DEBUG GEMINI] Simulating identifySubject in production...`);

    const start = Date.now();
    const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
    const duration = Date.now() - start;

    return NextResponse.json({
      success: true,
      maskedKey,
      materialName: material.fileName,
      durationMs: duration,
      idResult
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}
