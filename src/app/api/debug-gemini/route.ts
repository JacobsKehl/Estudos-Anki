import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "GEMINI_API_KEY is not defined in Vercel environment variables.",
        present: false
      });
    }

    const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
    const keyLength = apiKey.length;
    const hasQuotes = apiKey.startsWith('"') || apiKey.endsWith('"') || apiKey.startsWith("'") || apiKey.endsWith("'");
    const hasSpaces = apiKey.trim() !== apiKey;

    console.log(`[DEBUG GEMINI] Masked Key: ${maskedKey}, Length: ${keyLength}`);

    const results: Record<string, { success: boolean; reply?: string; error?: string }> = {};
    const modelsToTest = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

    const genAI = new GoogleGenerativeAI(apiKey);

    for (const mName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: mName });
        const response = await model.generateContent("Respond with 'OK'");
        results[mName] = {
          success: true,
          reply: response.response.text().trim()
        };
      } catch (err: any) {
        results[mName] = {
          success: false,
          error: err.message
        };
      }
    }

    return NextResponse.json({
      success: true,
      maskedKey,
      keyLength,
      hasQuotes,
      hasSpaces,
      results
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
}
