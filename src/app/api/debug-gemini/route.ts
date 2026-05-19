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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const response = await model.generateContent("Hello, respond with 'Success' if you can read this.");
    const replyText = response.response.text();

    return NextResponse.json({
      success: true,
      maskedKey,
      keyLength,
      hasQuotes,
      hasSpaces,
      replyText
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
      maskedKey: process.env.GEMINI_API_KEY 
        ? `${process.env.GEMINI_API_KEY.substring(0, 6)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}`
        : "NONE"
    });
  }
}
