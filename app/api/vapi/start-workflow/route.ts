import { NextRequest, NextResponse } from "next/server";
// Uncomment after installing: npm install @vapi-ai/server-sdk
// import Vapi from "@vapi-ai/server-sdk";

export async function POST(request: NextRequest) {
  try {
    const { workflowId, userId, userName } = await request.json();

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // Step 1: Install @vapi-ai/server-sdk
    // Step 2: Get VAPI_SERVER_API_KEY from dashboard and add to .env.local
    // Step 3: Uncomment the code below
    
    /*
    const serverApiKey = process.env.VAPI_SERVER_API_KEY;
    
    if (!serverApiKey) {
      throw new Error("VAPI_SERVER_API_KEY is not configured");
    }

    const vapi = new Vapi({ token: serverApiKey });

    // Start a web call with the workflow
    const call = await vapi.calls.createWebCall({
      workflowId: workflowId,
      // Pass variables that the workflow expects
      variableValues: {
        userid: userId,
        username: userName,
      },
    });

    return NextResponse.json({ 
      success: true,
      webCallUrl: call.webCallUrl, // URL to connect to the call
      callId: call.id,
    });
    */

    return NextResponse.json(
      { 
        error: "Server SDK not yet configured",
        instructions: [
          "1. Run: npm install @vapi-ai/server-sdk",
          "2. Get server API key from Vapi dashboard",
          "3. Add VAPI_SERVER_API_KEY to .env.local",
          "4. Uncomment the code in this file",
        ]
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("Error starting workflow:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start workflow" },
      { status: 500 }
    );
  }
}
