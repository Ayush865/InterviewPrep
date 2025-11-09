import { NextResponse } from "next/server";

export async function GET() {
  const workflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
  const webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
  
  console.log("Testing Vapi workflow configuration:");
  console.log("Workflow ID:", workflowId);
  console.log("Web Token present:", !!webToken);
  console.log("Web Token (first 8 chars):", webToken?.substring(0, 8));
  
  if (!workflowId) {
    return NextResponse.json({
      success: false,
      error: "NEXT_PUBLIC_VAPI_WORKFLOW_ID not set",
    }, { status: 400 });
  }
  
  if (!webToken) {
    return NextResponse.json({
      success: false,
      error: "NEXT_PUBLIC_VAPI_WEB_TOKEN not set",
    }, { status: 400 });
  }
  
  // Try to fetch workflow details from Vapi API
  try {
    const response = await fetch(
      `https://api.vapi.ai/workflow/${workflowId}`,
      {
        headers: {
          Authorization: `Bearer ${webToken}`,
        },
      }
    );
    
    const data = await response.json();
    
    console.log("Vapi API response:", {
      status: response.status,
      statusText: response.statusText,
    });
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      workflowId,
      workflowName: data.name,
      hasNodes: !!data.nodes,
      nodeCount: data.nodes?.length,
      data,
    });
  } catch (error: any) {
    console.error("Error testing workflow:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      workflowId,
    }, { status: 500 });
  }
}
