import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));
    
    // Handle both Vapi function call format and direct parameters
    let type, role, level, techstack, amount, userid;
    
    if (body.message?.functionCall?.parameters) {
      // Vapi function call format
      const params = body.message.functionCall.parameters;
      ({ type, role, level, techstack, amount, userid } = params);
      console.log("Extracted from Vapi function call format");
    } else {
      // Direct parameters format
      ({ type, role, level, techstack, amount, userid } = body);
      console.log("Using direct parameters format");
    }

    console.log("Raw userid received:", { userid, type: typeof userid, isNull: userid === null, isStringNull: userid === "NULL" });

    // Validate required fields and check for "NULL" string
    if (!type || !role || !level || !techstack || !amount || !userid || userid === "NULL" || userid === "null") {
      console.error("Validation failed - Missing or invalid fields:", { type, role, level, techstack, amount, userid });
      return Response.json(
        { 
          success: false, 
          error: "Missing required fields or userid is NULL",
          received: { type, role, level, techstack, amount, userid }
        }, 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log("Generating questions with:", { type, role, level, techstack, amount, userid });

    // Check if Firebase is properly initialized
    if (!db) {
      console.error("Firebase Admin DB is not initialized");
      return Response.json(
        { 
          success: false, 
          error: "Database connection failed. Check Firebase environment variables."
        }, 
        { status: 500, headers: corsHeaders }
      );
    }

    // Check user's premium status and interview count
    const userDoc = await db.collection("users").doc(userid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const isPremium = userData?.premium_user === true;
      const interviews = userData?.interviews || {};
      const interviewCount = Object.keys(interviews).length;

      console.log(`[DEBUG] User ${userid} Data:`, JSON.stringify(userData, null, 2));
      console.log(`[DEBUG] Check: Premium=${isPremium}, InterviewsCount=${interviewCount}, InterviewsKeys=${Object.keys(interviews)}`);

      if (!isPremium && interviewCount >= 1) {
        console.warn(`[DEBUG] User ${userid} reached interview generation limit (Non-Premium)`);
        return Response.json(
          { 
            success: false, 
            error: "Free plan limit reached. You can only generate 1 interview. Upgrade to Premium for unlimited access."
          }, 
          { status: 403, headers: corsHeaders }
        );
      }
    } else {
      console.log(`[DEBUG] User ${userid} not found in DB during check`);
    }

    const { text: questions } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `,
    });

    console.log("Generated questions:", questions);

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(","),
      questions: JSON.parse(questions),
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    const interviewRef = await db.collection("interviews").add(interview);
    const interviewId = interviewRef.id;
    
    // Add interview reference to user's interview map
    try {
      const userRef = db.collection("users").doc(userid);
      await userRef.set({
        interviews: {
          [interviewId]: interviewRef,
        },
        // Ensure premium_user is set if creating for the first time, but don't overwrite if exists
        // Note: merge: true with set will merge top-level fields. 
        // If we want to set premium_user only if missing, we might need a check or just rely on the fact that 
        // if we are here, the user might not exist.
        // However, if the user DOES exist, we don't want to overwrite premium_user to false if it was true.
        // But wait, if the user exists, we just want to add to interviews.
        // If the user does NOT exist, we want to create with premium_user: false.
      }, { merge: true });
      
      // Double check if premium_user needs to be initialized (if it was just created)
      // Since we can't conditionally set a field in a merge based on existence in one go easily without a transaction or pre-check.
      // Let's do a pre-check since we already did one at the top (userDoc).
      
      if (!userDoc.exists) {
         await userRef.set({ premium_user: false, feedbacks: {} }, { merge: true });
      }

      console.log(`Added interview reference ${interviewId} to user ${userid}'s map`);
    } catch (error) {
      console.error("Error updating user's interview map:", error);
      // Don't fail the whole request if this fails
    }

    return Response.json({ success: true }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Error in /api/vapi/generate:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return Response.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to generate interview questions",
        details: error instanceof Error ? error.stack : String(error)
      }, 
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  return Response.json(
    { success: true, data: "Thank you!" }, 
    { status: 200, headers: corsHeaders }
  );
}
