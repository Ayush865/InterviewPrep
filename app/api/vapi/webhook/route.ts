import { NextRequest, NextResponse } from "next/server";

// Add CORS headers for Vapi to access this endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("=== VAPI WEBHOOK CALLED ===");
    console.log("Full request body:", JSON.stringify(body, null, 2));

    // Extract variables from Vapi's message format
    let role, type, level, amount, userid, techstack;

    // Check if it's from function call
    if (body.message?.functionCall?.parameters) {
      console.log("Extracting from function call format");
      const params = body.message.functionCall.parameters;
      role = params.role;
      type = params.type;
      level = params.level;
      amount = params.amount;
      userid = params.userid;
      techstack = params.techstack;
    } else {
      console.log("Extracting from direct body format");
      // Direct body parameters
      role = body.role;
      type = body.type;
      level = body.level;
      amount = body.amount;
      userid = body.userid;
      techstack = body.techstack;
    }

    console.log("Extracted parameters:", { role, type, level, amount, userid, techstack });

    // Validate we have the required data
    if (!role || !type || !level || !amount || !userid || !techstack) {
      console.error("Missing required parameters:", { role, type, level, amount, userid, techstack });
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters",
          received: { role, type, level, amount, userid, techstack }
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call your generate endpoint with correct format
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                    'http://localhost:3000';
    
    const generateUrl = `${baseUrl}/api/vapi/generate`;
    
    console.log("Calling generate endpoint:", generateUrl);
    
    const response = await fetch(generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: role,
        type: type,
        level: level,
        amount: amount.toString(),
        userid: userid,
        techstack: techstack,
      }),
    });

    const result = await response.json();
    console.log("Generate endpoint result:", result);

    // Return in Vapi's expected format
    if (body.message?.toolCallId) {
      // Function call format - return results array
      console.log("Returning function call format response");
      return NextResponse.json({
        results: [{
          toolCallId: body.message.toolCallId,
          result: result.success ? "Interview questions generated successfully!" : "Failed to generate questions"
        }]
      }, { headers: corsHeaders });
    } else {
      // Direct format
      console.log("Returning direct format response");
      return NextResponse.json(result, { headers: corsHeaders });
    }
  } catch (error: any) {
    console.error("=== WEBHOOK ERROR ===");
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error",
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: true, message: "Vapi webhook endpoint is active" }, 
    { status: 200, headers: corsHeaders }
  );
}
