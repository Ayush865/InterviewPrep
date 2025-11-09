import { NextResponse } from "next/server";

export async function GET() {
  const envVars = {
    NEXT_PUBLIC_VAPI_WORKFLOW_ID: process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID,
    NEXT_PUBLIC_VAPI_WEB_TOKEN: process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.substring(0, 8) + "...",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.substring(0, 8) + "...",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    NODE_ENV: process.env.NODE_ENV,
  };
  
  console.log("Environment variables check:", envVars);
  
  return NextResponse.json({
    success: true,
    env: envVars,
    allPresent: !!(
      process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID &&
      process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN &&
      process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ),
  });
}
