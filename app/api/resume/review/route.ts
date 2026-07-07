/**
 * app/api/resume/review/route.ts
 *
 * AI resume review: ATS-style score, strengths, issues, and bullet
 * rewrites. Pro: 1/month, Elite: unlimited (enforced server-side).
 */

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  getUserResumeByUserId,
  createResumeReview,
} from "@/lib/db-queries";
import { canUseResumeReview } from "@/lib/actions/premium.action";
import { logger } from "@/lib/logger";

const reviewSchema = z.object({
  atsScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).min(1),
  issues: z.array(z.string()).min(1),
  bulletRewrites: z
    .array(z.object({ original: z.string(), improved: z.string() }))
    .min(1),
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Plan gate: resume reviews are a paid feature with monthly limits
    const gate = await canUseResumeReview(userId);
    if (!gate.allowed) {
      logger.warn(`[ResumeReview] Limit reached for user ${userId}`, gate);
      return Response.json(
        {
          error:
            gate.limit === 0
              ? "AI resume reviews are a Pro feature. Upgrade to unlock them."
              : `You've used your ${gate.limit} resume review${gate.limit === 1 ? "" : "s"} for this month. Upgrade to Elite for unlimited reviews.`,
        },
        { status: 403 }
      );
    }

    const resume = await getUserResumeByUserId(userId);
    if (!resume?.raw_text) {
      return Response.json(
        { error: "Upload a resume first, then run a review." },
        { status: 400 }
      );
    }

    let targetRole: string | null = resume.parsed_role;
    try {
      const body = await request.json();
      if (typeof body.targetRole === "string" && body.targetRole.trim()) {
        targetRole = body.targetRole.trim().slice(0, 200);
      }
    } catch {
      // no body — use the parsed role
    }

    logger.info(`[ResumeReview] Generating review for user ${userId}`, {
      targetRole,
      resumeChars: resume.raw_text.length,
    });

    const startedAt = Date.now();
    const nimResponse = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [
            {
              role: "system",
              content:
                "You are a senior technical recruiter and resume expert. Return ONLY valid JSON — no markdown, no extra text.",
            },
            {
              role: "user",
              content: `Review this resume${targetRole ? ` for a ${targetRole} role` : ""}. Score it 0-100 the way an ATS + recruiter screen would: keyword coverage, quantified impact, clarity, structure, and relevance. Be strict and specific — generic praise is useless.

Resume:
${resume.raw_text.substring(0, 8000)}

Return ONLY this JSON structure:
{
  "atsScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<string>", "..."],
  "issues": ["<specific problem and why it hurts>", "..."],
  "bulletRewrites": [
    { "original": "<a weak bullet quoted from the resume>", "improved": "<rewritten with action verb + quantified impact>" }
  ]
}
Include 3-5 strengths, 3-5 issues, and 3 bulletRewrites.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        }),
      }
    );

    if (!nimResponse.ok) {
      const errorBody = await nimResponse.text();
      logger.error(`[ResumeReview] NVIDIA API error for user ${userId}`, {
        status: nimResponse.status,
        body: errorBody.slice(0, 500),
      });
      throw new Error("The review service is unavailable. Please try again.");
    }

    const nimData = await nimResponse.json();
    const rawContent = nimData.choices[0].message.content;
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = reviewSchema.parse(JSON.parse(cleaned));

    const review = await createResumeReview({
      user_id: userId,
      target_role: targetRole,
      ats_score: parsed.atsScore,
      summary: parsed.summary,
      strengths: parsed.strengths,
      issues: parsed.issues,
      bullet_rewrites: parsed.bulletRewrites,
    });

    logger.info(`[ResumeReview] Review ${review.id} created for user ${userId}`, {
      atsScore: parsed.atsScore,
      latencyMs: Date.now() - startedAt,
    });

    return Response.json({ success: true, review });
  } catch (error: any) {
    logger.error("[ResumeReview] Error generating review:", error);
    return Response.json(
      { error: error.message || "Failed to review resume" },
      { status: 500 }
    );
  }
}
