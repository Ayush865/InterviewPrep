import { getLogoForCompany } from "@/lib/utils";
import { getUserById, createInterview, createUser } from "@/lib/db-queries";
import { getResumeVector } from "@/lib/vector-store";
import { logger } from "@/lib/logger";
import { getUserEntitlements } from "@/lib/actions/premium.action";
import { isVapiByokEnabled } from "@/lib/feature-flags";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

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

    // Handle both Vapi function call format and direct parameters.
    // The format also tells us the generation method: Vapi function calls
    // come from the hiring-manager call, direct params from the form.
    let type, role, level, techstack, amount, userid, company_name, use_resume,
      job_description, focus_area;
    let generationMethod: "form" | "call";

    if (body.message?.functionCall?.parameters) {
      // Vapi function call format
      const params = body.message.functionCall.parameters;
      logger.info("Function call parameters:", JSON.stringify(params, null, 2));
      ({ type, role, level, techstack, amount, userid, company_name, use_resume } = params);
      generationMethod = "call";
      logger.info("Extracted from Vapi function call format (call generation)");
    } else {
      // Direct parameters format
      ({ type, role, level, techstack, amount, userid, company_name, use_resume,
         job_description, focus_area } = body);
      generationMethod = "form";
      logger.info("Using direct parameters format (form generation)");
    }

    logger.info("=== EXTRACTED VALUES ===");
    logger.info(`type: ${type}, role: ${role}, level: ${level}, techstack: ${techstack}, amount: ${amount}, userid: ${userid}, company_name: ${company_name}, use_resume: ${use_resume}`);

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

    // Plan- and method-based generation limits:
    //   free: form unlimited, hiring-manager call limited to 1
    //   pro:  10/period (any method) — byok: unlimited
    const entitlements = await getUserEntitlements(userid);

    logger.info(`[User Check] User ${userid} entitlements`, {
      plan: entitlements.plan,
      method: generationMethod,
      generationsUsed: entitlements.generationsUsed,
      generationsLimit: entitlements.generationsLimit,
      callGenerationsUsed: entitlements.callGenerationsUsed,
      callGenerationsLimit: entitlements.callGenerationsLimit,
    });

    const allowed =
      generationMethod === "call"
        ? entitlements.canGenerateCall
        : entitlements.canGenerateForm;

    if (!allowed) {
      logger.warn(`[Limit] User ${userid} reached generation limit`, {
        plan: entitlements.plan,
        method: generationMethod,
        used:
          generationMethod === "call" && entitlements.plan === "free"
            ? entitlements.callGenerationsUsed
            : entitlements.generationsUsed,
      });
      const byokHint = isVapiByokEnabled()
        ? " or connect your own Vapi key for unlimited access"
        : "";
      const error =
        entitlements.plan === "pro"
          ? `You've used all ${entitlements.generationsLimit} interview generations for this billing period. Your quota resets on renewal${byokHint}.`
          : `Free plan limit reached: the hiring-manager call includes ${entitlements.callGenerationsLimit} interview generation. Use the form for unlimited generations, upgrade to Pro${byokHint}.`;
      return Response.json(
        { success: false, error },
        { status: 403, headers: corsHeaders }
      );
    }

    // JD-based interviews and targeted drills are paid features
    if ((job_description || focus_area) && !entitlements.features.jdInterviews) {
      logger.warn(`[Limit] User ${userid} attempted a paid generation feature on free plan`, {
        hasJobDescription: !!job_description,
        hasFocusArea: !!focus_area,
      });
      return Response.json(
        {
          success: false,
          error:
            "Job-description interviews and targeted drills are Pro features. Upgrade to unlock them.",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Optionally fetch resume context from Upstash Vector
    let resumeContext = "";
    if (use_resume && userid) {
      try {
        const resumeData = await getResumeVector(userid);
        if (resumeData) {
          resumeContext = `
The candidate has provided their resume. Use the following background to tailor every question to this specific candidate — probe their actual experience, address skill gaps, and reference technologies they have used:
- Current/Target Role: ${resumeData.parsed_role ?? "Not specified"}
- Experience Level: ${resumeData.parsed_level ?? "Not specified"}
- Skills: ${resumeData.parsed_skills?.join(", ") ?? "Not specified"}
- Professional Summary: ${resumeData.parsed_summary ?? "Not specified"}
- Full Resume:
${resumeData.raw_text.substring(0, 6000)}
`;
          logger.info("[Interview] Resume context loaded from Upstash for user:", userid);
        }
      } catch (err) {
        // Non-fatal — continue without resume context
        logger.warn("[Interview] Could not load resume vector, proceeding without it:", err);
      }
    }

    // Build company-specific context for the prompt
    const companyContext = company_name
      ? `The interview is specifically for a position at ${company_name}.
         Generate questions that reflect ${company_name}'s known interview style, company values, and engineering culture.
         Research and incorporate the latest interview patterns for a ${level}-level ${role} at ${company_name}.
         Include questions that ${company_name} is known to ask, covering both their technical bar and cultural expectations.`
      : `Generate high-quality, industry-standard interview questions.`;

    // Job-description context (Pro): tailor questions to the actual posting
    const jdContext = job_description
      ? `The candidate is interviewing for the following job posting. Base the questions directly on its requirements, responsibilities, and preferred qualifications — probe the specific skills it demands:
---
${String(job_description).substring(0, 5000)}
---`
      : "";

    // Targeted drill context (Pro): a short session focused on one weak area
    const drillContext = focus_area
      ? `This is a TARGETED PRACTICE DRILL. The candidate previously scored poorly on "${focus_area}".
         Every question must specifically exercise ${focus_area}. Make the questions progressively harder and keep them focused — this is a drill, not a general interview.`
      : "";

    const questionPrompt = `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        ${companyContext}
        ${jdContext}
        ${drillContext}
        ${resumeContext}
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]

        Thank you! <3
    `;

    // Generate interview questions via NVIDIA NIM
    const nimResponse = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: questionPrompt }],
        temperature: 0,
        max_tokens: 1024,
      }),
    });

    if (!nimResponse.ok) {
      throw new Error(`NVIDIA API error: ${await nimResponse.text()}`);
    }

    const nimData = await nimResponse.json();
    const questions: string = nimData.choices[0].message.content;

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
      cover_image: getLogoForCompany(company_name),
      company_name: company_name || null,
      generation_method: generationMethod,
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
