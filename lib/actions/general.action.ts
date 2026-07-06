"use server";

import { feedbackSchema } from "@/constants";
import {
  createFeedback as createFeedbackInDB,
  getInterviewById as getInterviewByIdFromDB,
  getFeedbackByInterviewAndUser,
  getLatestInterviews as getLatestInterviewsFromDB,
  getLatestInterviewsExcludingUser,
  getInterviewsByUserId as getInterviewsByUserIdFromDB,
  getTotalInterviewCount as getTotalInterviewCountFromDB,
  getInterviewsWithFeedbackByUserId as getInterviewsWithFeedbackByUserIdFromDB,
  getMostRecentInterviewByUserId,
  getUserDashboardInterviews,
  getDiscoverInterviews,
  getFeedbacksByUserAndInterviewIds,
  type Interview as InterviewRow,
} from "@/lib/db-queries";
import { logger } from "@/lib/logger";

/** Map a snake_case DB interview row to the camelCase app shape */
function mapInterview(interview: InterviewRow): Interview {
  return {
    id: interview.id,
    userId: interview.user_id,
    role: interview.role,
    type: interview.type,
    level: interview.level,
    techstack: interview.techstack,
    questions: interview.questions,
    finalized: interview.finalized,
    coverImage: interview.cover_image,
    companyName: interview.company_name ?? null,
    createdAt: interview.created_at.toISOString(),
  } as Interview;
}

/** Minimum characters of candidate speech required to score an interview */
const MIN_USER_RESPONSE_CHARS = 20;

/**
 * Create feedback for an interview using AI analysis
 * This replaces the Firebase version with MySQL
 */
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    // Transcript stats — the single most useful signal when debugging
    // "why did a silent candidate get scored"
    const userMessages = transcript.filter((m) => m.role === "user");
    const assistantMessages = transcript.filter((m) => m.role === "assistant");
    const userChars = userMessages.reduce(
      (sum, m) => sum + m.content.trim().length,
      0
    );

    logger.info(`[Feedback] Generation requested`, {
      interviewId,
      userId,
      totalMessages: transcript.length,
      assistantMessages: assistantMessages.length,
      userMessages: userMessages.length,
      userChars,
    });

    // Guard: don't score an interview the candidate never answered.
    // Without this, the transcript contains only the interviewer's speech
    // and the LLM hallucinates a plausible mid-range score.
    if (userMessages.length === 0 || userChars < MIN_USER_RESPONSE_CHARS) {
      logger.warn(
        `[Feedback] Skipped: insufficient candidate responses for interview ${interviewId}`,
        { userMessages: userMessages.length, userChars }
      );
      return { success: false, reason: "no_user_responses" as const };
    }

    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    // Generate feedback using NVIDIA NIM (meta/llama-3.1-8b-instruct)
    const nvidiaStartedAt = Date.now();
    const nvidiaResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [
          {
            role: "system",
            content: "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Return ONLY valid JSON — no markdown, no extra text.",
          },
          {
            role: "user",
            content: `You are an AI interviewer analyzing a mock interview. Evaluate the candidate based on structured categories. Be thorough and detailed. Don't be lenient — point out mistakes and areas for improvement.

Score ONLY what the candidate ("user" lines) actually said. If the candidate did not answer a question, answered very briefly, or gave off-topic answers, the relevant scores MUST be very low (0-15). Never invent answers the candidate did not give.

Transcript:
${formattedTranscript}

Score the candidate from 0 to 100 in each area and return ONLY this JSON structure:
{
  "totalScore": <number>,
  "categoryScores": [
    { "name": "Communication Skills", "score": <number>, "comment": "<string>" },
    { "name": "Technical Knowledge", "score": <number>, "comment": "<string>" },
    { "name": "Problem Solving", "score": <number>, "comment": "<string>" },
    { "name": "Cultural Fit", "score": <number>, "comment": "<string>" },
    { "name": "Confidence and Clarity", "score": <number>, "comment": "<string>" }
  ],
  "strengths": ["<string>", "..."],
  "areasForImprovement": ["<string>", "..."],
  "finalAssessment": "<string>"
}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!nvidiaResponse.ok) {
      const errorBody = await nvidiaResponse.text();
      logger.error(`[Feedback] NVIDIA API error for interview ${interviewId}`, {
        status: nvidiaResponse.status,
        body: errorBody.slice(0, 500),
      });
      throw new Error(`NVIDIA API error: ${errorBody}`);
    }

    const nvidiaData = await nvidiaResponse.json();
    const rawContent = nvidiaData.choices[0].message.content;
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const object = feedbackSchema.parse(JSON.parse(cleaned));

    logger.info(`[Feedback] Model scored interview ${interviewId}`, {
      latencyMs: Date.now() - nvidiaStartedAt,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores.map((c) => ({
        name: c.name,
        score: c.score,
      })),
    });

    // Save feedback to MySQL
    const feedback = await createFeedbackInDB({
      id: feedbackId,
      interview_id: interviewId,
      user_id: userId,
      total_score: object.totalScore,
      category_scores: object.categoryScores,
      strengths: object.strengths,
      areas_for_improvement: object.areasForImprovement,
      final_assessment: object.finalAssessment,
    });

    logger.info(`[Feedback] Created feedback ${feedback.id} for interview ${interviewId}`);

    return { success: true, feedbackId: feedback.id };
  } catch (error) {
    logger.error(`[Feedback] Error generating feedback for interview ${interviewId}:`, error);
    return { success: false, reason: "generation_failed" as const };
  }
}

/**
 * Get interview by ID from MySQL
 */
export async function getInterviewById(id: string): Promise<Interview | null> {
  try {
    const interview = await getInterviewByIdFromDB(id);

    if (!interview) {
      return null;
    }

    // Map snake_case database fields to camelCase
    return {
      id: interview.id,
      userId: interview.user_id,
      role: interview.role,
      type: interview.type,
      level: interview.level,
      techstack: interview.techstack,
      questions: interview.questions,
      finalized: interview.finalized,
      coverImage: interview.cover_image,
      companyName: interview.company_name ?? null,
      createdAt: interview.created_at.toISOString(),
    } as Interview;
  } catch (error) {
    logger.error(`[Interview] Error fetching interview ${id}:`, error);
    return null;
  }
}

/**
 * Get feedback by interview ID and user ID from MySQL
 */
export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  try {
    const feedback = await getFeedbackByInterviewAndUser(interviewId, userId);

    if (!feedback) {
      return null;
    }

    return {
      id: feedback.id,
      interviewId: feedback.interview_id,
      userId: feedback.user_id,
      totalScore: feedback.total_score,
      categoryScores: feedback.category_scores,
      strengths: feedback.strengths,
      areasForImprovement: feedback.areas_for_improvement,
      finalAssessment: feedback.final_assessment,
      createdAt: feedback.created_at.toISOString(),
    } as Feedback;
  } catch (error) {
    logger.error("[Feedback] Error fetching feedback:", error);
    return null;
  }
}

/**
 * Get latest finalized interviews, excluding user's own interviews
 */
export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  try {
    let interviews;

    // If userId is provided, exclude their interviews
    if (userId) {
      interviews = await getLatestInterviewsExcludingUser(userId, limit);
    } else {
      // Return all finalized interviews
      interviews = await getLatestInterviewsFromDB(limit);
    }

    return interviews.map((interview) => ({
      id: interview.id,
      userId: interview.user_id,
      role: interview.role,
      type: interview.type,
      level: interview.level,
      techstack: interview.techstack,
      questions: interview.questions,
      finalized: interview.finalized,
      coverImage: interview.cover_image,
      companyName: interview.company_name ?? null,
      createdAt: interview.created_at.toISOString(),
    })) as Interview[];
  } catch (error) {
    logger.error("[Interview] Error fetching latest interviews:", error);
    return null;
  }
}

/**
 * Get all interviews for a specific user from MySQL
 * This is MUCH simpler than the Firebase version with DocumentReferences!
 */
export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  // Validate userId
  if (!userId) {
    logger.warn("[Interview] getInterviewsByUserId called with undefined or empty userId");
    return null;
  }

  try {
    const interviews = await getInterviewsByUserIdFromDB(userId);

    return interviews.map((interview) => ({
      id: interview.id,
      userId: interview.user_id,
      role: interview.role,
      type: interview.type,
      level: interview.level,
      techstack: interview.techstack,
      questions: interview.questions,
      finalized: interview.finalized,
      coverImage: interview.cover_image,
      companyName: interview.company_name ?? null,
      createdAt: interview.created_at.toISOString(),
    })) as Interview[];
  } catch (error) {
    logger.error("[Interview] Error fetching interviews by user ID:", error);
    return null;
  }
}

/**
 * Get total count of all interviews
 */
export async function getTotalInterviewCount(): Promise<number> {
  try {
    return await getTotalInterviewCountFromDB();
  } catch (error) {
    logger.error("[Interview] Error fetching total interview count:", error);
    return 0;
  }
}

/**
 * Get interviews that a user has taken (has feedback for)
 * These are interviews created by OTHER users that this user has completed
 */
export async function getInterviewsTakenByUser(
  userId: string
): Promise<Interview[] | null> {
  if (!userId) {
    logger.warn("[Interview] getInterviewsTakenByUser called with undefined or empty userId");
    return null;
  }

  try {
    const interviews = await getInterviewsWithFeedbackByUserIdFromDB(userId);

    return interviews.map((interview) => ({
      id: interview.id,
      userId: interview.user_id,
      role: interview.role,
      type: interview.type,
      level: interview.level,
      techstack: interview.techstack,
      questions: interview.questions,
      finalized: interview.finalized,
      coverImage: interview.cover_image,
      companyName: interview.company_name ?? null,
      createdAt: interview.created_at.toISOString(),
    })) as Interview[];
  } catch (error) {
    logger.error("[Interview] Error fetching interviews taken by user:", error);
    return null;
  }
}

/**
 * Get the most recently created interview for a user
 * Used to fetch interview ID after VAPI call ends
 */
export interface DashboardInterview extends Interview {
  isTaken: boolean;
}

export interface FeedbackSummary {
  totalScore: number;
  finalAssessment: string;
  createdAt: string;
}

/**
 * Paginated "your interviews" (created + taken) for the dashboard
 */
export async function getUserInterviewsPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ interviews: DashboardInterview[]; total: number }> {
  if (!userId) return { interviews: [], total: 0 };

  try {
    const offset = (Math.max(1, page) - 1) * pageSize;
    const { interviews, total } = await getUserDashboardInterviews(
      userId,
      pageSize,
      offset
    );

    return {
      interviews: interviews.map((row) => ({
        ...mapInterview(row),
        isTaken: row.is_taken,
      })),
      total,
    };
  } catch (error) {
    logger.error("[Interview] Error fetching user interviews page:", error);
    return { interviews: [], total: 0 };
  }
}

/**
 * Paginated community interviews the user hasn't taken yet
 */
export async function getDiscoverInterviewsPage(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ interviews: Interview[]; total: number }> {
  if (!userId) return { interviews: [], total: 0 };

  try {
    const offset = (Math.max(1, page) - 1) * pageSize;
    const { interviews, total } = await getDiscoverInterviews(
      userId,
      pageSize,
      offset
    );

    return { interviews: interviews.map(mapInterview), total };
  } catch (error) {
    logger.error("[Interview] Error fetching discover interviews page:", error);
    return { interviews: [], total: 0 };
  }
}

/**
 * Batch feedback summaries for a set of interviews, keyed by interview ID.
 * One query instead of one per interview card.
 */
export async function getFeedbackSummaries(
  userId: string,
  interviewIds: string[]
): Promise<Record<string, FeedbackSummary>> {
  if (!userId || interviewIds.length === 0) return {};

  try {
    const feedbacks = await getFeedbacksByUserAndInterviewIds(
      userId,
      interviewIds
    );

    return Object.fromEntries(
      feedbacks.map((feedback) => [
        feedback.interview_id,
        {
          totalScore: feedback.total_score,
          finalAssessment: feedback.final_assessment,
          createdAt: feedback.created_at.toISOString(),
        },
      ])
    );
  } catch (error) {
    logger.error("[Feedback] Error batch fetching feedback summaries:", error);
    return {};
  }
}

export async function getLatestGeneratedInterview(
  userId: string
): Promise<{ success: boolean; interviewId?: string }> {
  if (!userId) {
    logger.warn("[Interview] getLatestGeneratedInterview called with empty userId");
    return { success: false };
  }

  try {
    const interview = await getMostRecentInterviewByUserId(userId, 1);

    if (interview) {
      return { success: true, interviewId: interview.id };
    }

    return { success: false };
  } catch (error) {
    logger.error("[Interview] Error fetching latest generated interview:", error);
    return { success: false };
  }
}
