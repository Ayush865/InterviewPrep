"use server";

import { db } from "@/firebase/admin";
export async function getUserFeedbackCount(userId: string): Promise<number> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return 0;
    }

    const userData = userDoc.data();
    const feedbacks = userData?.feedbacks || {};
    return Object.keys(feedbacks).length;
  } catch (error) {
    console.error("Error fetching user feedback count:", error);
    return 0;
  }
}

export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    return userDoc.data()?.premium_user === true;
  } catch (error) {
    console.error("Error fetching user premium status:", error);
    return false;
  }
}
