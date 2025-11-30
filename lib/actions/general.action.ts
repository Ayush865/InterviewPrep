"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

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
} from "@/lib/db-queries";
import { logger } from "@/lib/logger";

/**
 * Create feedback for an interview using AI analysis
 * This replaces the Firebase version with MySQL
 */
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    logger.info(`[Feedback] Generating feedback for interview ${interviewId}`);

    // Generate feedback using AI
    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", {
        structuredOutputs: false,
      }),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
      system:
        "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
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
    logger.error("[Feedback] Error saving feedback:", error);
    return { success: false };
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
