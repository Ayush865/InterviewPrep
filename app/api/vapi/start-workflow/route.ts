import { NextRequest, NextResponse } from "next/server";
import { VapiClient } from "@vapi-ai/server-sdk";

export async function POST(request: NextRequest) {
  try {
    const { workflowId, userId, userName } = await request.json();

    console.log("Starting workflow with:", { workflowId, userId, userName });

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // Use web token for now (server token is different and requires separate API key)
    const serverApiKey = process.env.VAPI_SERVER_API_KEY || process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
    
    if (!serverApiKey) {
      console.error("VAPI_SERVER_API_KEY is not configured");
      return NextResponse.json(
        { 
          error: "VAPI_SERVER_API_KEY is not configured",
          instructions: "Get your server API key from Vapi dashboard and add VAPI_SERVER_API_KEY to .env.local"
        },
        { status: 500 }
      );
    }

    const vapi = new VapiClient({ token: serverApiKey });

    // Start a web call with the workflow
    // For web calls, just pass workflowId and workflowOverrides directly
    const call = await vapi.calls.create({
      workflowId: workflowId,
      // Use workflowOverrides to pass variables to the workflow
      workflowOverrides: {
        variableValues: {
          userid: userId,
        },
      },
    });

    console.log("Workflow call created:", call);

    // The response type can be Call or CallBatchResponse
    // For web calls, it returns a Call with webCallUrl
    return NextResponse.json({ 
      success: true,
      call: call,
    });
  } catch (error) {
    console.error("Error starting workflow:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to start workflow",
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}
