/**
 * lib/vector-store.ts
 *
 * Upstash Vector client for storing and retrieving resume embeddings.
 * Each user has one vector stored with their user_id as the vector ID.
 * Resume text and parsed fields are stored as metadata alongside the vector.
 *
 * Setup:
 *   1. Create a free Upstash Vector index at https://console.upstash.com/vector
 *   2. Set the dimension to 1024 (matches NVIDIA nv-embedqa-e5-v5)
 *   3. Add UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN to .env.local
 */

import { Index } from "@upstash/vector";
import { logger } from "./logger";

// Metadata shape stored alongside each resume vector in Upstash.
// The index signature satisfies @upstash/vector's Dict constraint.
type ResumeVectorMetadata = {
  raw_text: string;
  parsed_role: string | null;
  parsed_level: string | null;
  parsed_skills: string[];
  parsed_summary: string | null;
  file_name: string | null;
  updated_at: string;
  [key: string]: unknown;
};

function getIndex(): Index<ResumeVectorMetadata> {
  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    throw new Error("Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN environment variables.");
  }
  return new Index<ResumeVectorMetadata>({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  });
}

/**
 * Upsert a resume vector for a user.
 * Uses user_id as the vector ID so re-uploading a resume overwrites the old vector.
 */
export async function upsertResumeVector(
  userId: string,
  embedding: number[],
  metadata: ResumeVectorMetadata
): Promise<void> {
  const index = getIndex();

  try {
    await index.upsert({
      id: userId,
      vector: embedding,
      metadata,
    });
    logger.info(`[VectorStore] Resume vector upserted for user: ${userId}`);
  } catch (error: any) {
    logger.error(`[VectorStore] Error upserting resume vector:`, error);
    throw new Error(`Vector store error: ${error.message}`);
  }
}

/**
 * Fetch a user's resume metadata from Upstash by their user_id.
 * Returns null if no resume vector is found.
 */
export async function getResumeVector(
  userId: string
): Promise<ResumeVectorMetadata | null> {
  const index = getIndex();

  try {
    const results = await index.fetch([userId], { includeMetadata: true });
    const record = results[0];

    if (!record || !record.metadata) {
      return null;
    }

    return record.metadata as ResumeVectorMetadata;
  } catch (error: any) {
    logger.error(`[VectorStore] Error fetching resume vector:`, error);
    throw new Error(`Vector store error: ${error.message}`);
  }
}

/**
 * Delete a user's resume vector from Upstash.
 * Called when a user deletes their account or resume.
 */
export async function deleteResumeVector(userId: string): Promise<void> {
  const index = getIndex();

  try {
    await index.delete([userId]);
    logger.info(`[VectorStore] Resume vector deleted for user: ${userId}`);
  } catch (error: any) {
    logger.error(`[VectorStore] Error deleting resume vector:`, error);
    throw new Error(`Vector store error: ${error.message}`);
  }
}
