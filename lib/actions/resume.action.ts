"use server";

import { getUserResumeByUserId } from "@/lib/db-queries";

export interface ParsedResumeData {
  parsedRole: string | null;
  parsedLevel: string | null;
  parsedSkills: string[];
  parsedSummary: string | null;
  fileName: string | null;
  updatedAt: string;
}

/**
 * Server action: fetch the user's stored resume data.
 * Returns null if the user has not uploaded a resume yet.
 */
export async function getResumeByUserId(
  userId: string
): Promise<ParsedResumeData | null> {
  const resume = await getUserResumeByUserId(userId);

  if (!resume) return null;

  return {
    parsedRole: resume.parsed_role,
    parsedLevel: resume.parsed_level,
    parsedSkills: resume.parsed_skills ?? [],
    parsedSummary: resume.parsed_summary,
    fileName: resume.file_name,
    updatedAt: resume.updated_at.toISOString(),
  };
}
