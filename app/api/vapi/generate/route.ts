import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { getRandomInterviewCover } from "@/lib/utils";
import { getUserById, getUserCounts, createInterview, createUser } from "@/lib/db-queries";
import { logger } from "@/lib/logger";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";

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
    logger.info("=== VAPI GENERATE DEBUG ===");
    logger.info("Full request body:", JSON.stringify(body, null, 2));

    // Handle both Vapi function call format and direct parameters
    let type, role, level, techstack, amount, userid;

    if (body.message?.functionCall?.parameters) {
      // Vapi function call format
      const params = body.message.functionCall.parameters;
      logger.info("Function call parameters:", JSON.stringify(params, null, 2));
      ({ type, role, level, techstack, amount, userid } = params);
      logger.info("Extracted from Vapi function call format");
    } else {
      // Direct parameters format
      ({ type, role, level, techstack, amount, userid } = body);
      logger.info("Using direct parameters format");
    }

    logger.info("=== EXTRACTED VALUES ===");
    logger.info(`type: ${type}, role: ${role}, level: ${level}, techstack: ${techstack}, amount: ${amount}, userid: ${userid}`);

    // Validate required fields and check for "NULL" string
    // if (!type || !role || !level || !techstack || !amount || !userid || userid === "NULL" || userid === "null") {
    //   logger.error("Validation failed - Missing or invalid fields:", { type, role, level, techstack, amount, userid });
    //   return Response.json(
    //     {
    //       success: false,
    //       error: "Missing required fields or userid is NULL",
    //       received: { type, role, level, techstack, amount, userid }
    //     },
    //     { status: 400, headers: corsHeaders }
    //   );
    // }

    logger.info("Generating questions for user:", userid);

    // Check user's premium status and interview count using MySQL
    let user = await getUserById(userid);

    // If user doesn't exist, create them (Clerk user not yet synced)
    if (!user) {
      logger.info(`[User Check] User ${userid} not found in MySQL, creating...`);
      try {
        user = await createUser({
          id: userid,
          name: 'User', // Default name, will be updated by Clerk webhook
          email: `${userid}@temp.com`, // Temporary email, will be updated by Clerk webhook
        });
        logger.info(`[User Check] Created user ${userid} in MySQL`);
      } catch (createError) {
        logger.error(`[User Check] Error creating user ${userid}:`, createError);
        return Response.json(
          {
            success: false,
            error: "Failed to create user record. Please try again."
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Check premium status and interview limit
    const counts = await getUserCounts(userid);
    // MySQL returns 1/0 for boolean columns, use Boolean() to handle both cases
    const isPremium = Boolean(user.premium_user);
    const interviewCount = counts.interviewCount;

    // Check if user has their own VAPI credentials
    const hasVapiCredentials = await hasUserVapiCredentials(userid);

    logger.info(`[User Check] User ${userid}: Premium=${isPremium}, Interviews=${interviewCount}, HasVapiCredentials=${hasVapiCredentials}`);

    if (!isPremium && !hasVapiCredentials && interviewCount >= 1) {
      logger.warn(`[Limit] User ${userid} reached interview generation limit (Non-Premium, No VAPI credentials)`);
      return Response.json(
        {
          success: false,
          error: "Free plan limit reached. You can only generate 1 interview. Upgrade to Premium for unlimited access."
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Generate interview questions using AI
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

    logger.info("[Interview] Generated questions successfully");

    // Create interview in MySQL
    const interview = await createInterview({
      user_id: userid,
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(",").map((t: string) => t.trim()),
      questions: JSON.parse(questions),
      finalized: true,
      cover_image: getRandomInterviewCover(),
    });

    logger.info(`[Interview] Created interview ${interview.id} for user ${userid}`);

    return Response.json({ success: true, interviewId: interview.id }, { status: 200, headers: corsHeaders });
  } catch (error) {
    logger.error("Error in /api/vapi/generate:", {
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
