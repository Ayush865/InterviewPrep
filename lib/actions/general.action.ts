"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

export async function addInterviewToUserMap(userId: string, interviewId: string) {
  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.warn("User not found in Firebase, creating user document:", userId);
      
      // Create user document with the interview
      const interviewRef = db.collection("interviews").doc(interviewId);
      
      await userRef.set({
        interviews: {
          [interviewId]: interviewRef,
        },
        feedbacks: {},
        premium_user: false,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Created user document and added interview ${interviewId} for user ${userId}`);
      return { success: true };
    }

    // Create reference to the interview document
    const interviewRef = db.collection("interviews").doc(interviewId);

    // Add interview reference to user's interviews map
    await userRef.update({
      [`interviews.${interviewId}`]: interviewRef,
    });

    console.log(`Added interview reference ${interviewId} to user ${userId}'s map`);
    return { success: true };
  } catch (error) {
    console.error("Error adding interview to user map:", error);
    return { success: false, error };
  }
}

async function addFeedbackToUserMap(userId: string, feedbackId: string, feedbackRef: FirebaseFirestore.DocumentReference) {
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.set({
      feedbacks: {
        [feedbackId]: feedbackRef,
      },
    }, { merge: true });
    console.log(`Added feedback reference ${feedbackId} to user ${userId}'s map`);
  } catch (error) {
    console.error("Error adding feedback to user map:", error);
  }
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

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

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    // Add interview to user's interview map
    await addInterviewToUserMap(userId, interviewId);

    // Add feedback to user's feedbacks map
    await addFeedbackToUserMap(userId, feedbackRef.id, feedbackRef);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  // Add validation to prevent undefined userId
  if (!userId) {
    console.warn("getLatestInterviews called with undefined or empty userId");
    // Return all finalized interviews without filtering by userId
    const interviews = await db
      .collection("interviews")
      .orderBy("createdAt", "desc")
      .where("finalized", "==", true)
      .limit(limit)
      .get();

    return interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];
  }

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  // Add validation to prevent undefined userId
  if (!userId) {
    console.warn("getInterviewsByUserId called with undefined or empty userId");
    return null;
  }

  try {
    // Get user document to fetch interview references from the map
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      console.warn("User not found in Firebase, creating user document:", userId);
      
      // Create user document with empty interviews map
      try {
        await db.collection("users").doc(userId).set({
          interviews: {},
          feedbacks: {},
          premium_user: false,
          createdAt: new Date().toISOString(),
        });
        console.log("Created user document for:", userId);
      } catch (createError) {
        console.error("Error creating user document:", createError);
      }
      
      // Return empty array since user has no interviews yet
      return [];
    }

    const userData = userDoc.data();
    const interviewsMap = userData?.interviews || {};
    
    // Get interview references from the map
    const interviewRefs = Object.values(interviewsMap);

    // If user has no interviews, return empty array
    if (interviewRefs.length === 0) {
      return [];
    }

    // Fetch all interviews using the references
    const interviewPromises = interviewRefs.map(async (ref: any) => {
      try {
        // If ref is a DocumentReference, use .get()
        if (ref && typeof ref.get === 'function') {
          const interviewDoc = await ref.get();
          if (interviewDoc.exists) {
            return {
              id: interviewDoc.id,
              ...interviewDoc.data(),
            } as Interview;
          }
        }
        return null;
      } catch (error) {
        console.error("Error fetching interview reference:", error);
        return null;
      }
    });

    const interviews = await Promise.all(interviewPromises);
    
    // Filter out null values and sort by createdAt
    const validInterviews = interviews
      .filter((interview): interview is Interview => interview !== null)
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Sort descending (newest first)
      });

    return validInterviews;
  } catch (error) {
    console.error("Error fetching interviews by user ID:", error);
    return null;
  }
}

export async function getTotalInterviewCount(): Promise<number> {
  try {
    const snapshot = await db.collection("interviews").count().get();
    return snapshot.data().count;
  } catch (error) {
    console.error("Error fetching total interview count:", error);
    return 0;
  }
}
