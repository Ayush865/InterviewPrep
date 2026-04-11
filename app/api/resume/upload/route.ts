/**
 * app/api/resume/upload/route.ts
 *
 * Handles resume file uploads (PDF or DOCX).
 * Flow:
 *   1. Parse multipart form: { file, userid }
 *   2. Extract raw text using pdf-parse (PDF) or mammoth (DOCX)
 *   3. Call NVIDIA NIM (llama-3.1-8b-instruct) to extract structured fields: role, level, skills[], summary
 *   4. Generate text embedding via NVIDIA NIM (llama-3.2-nemoretriever-300m-embed-v1, 1024-dim)
 *   5. Upsert vector into Upstash (userId as vector ID, metadata = parsed fields + raw_text)
 *   6. Upsert row into MySQL user_resumes table
 *   7. Return parsed resume data to client
 */

// pdf-parse reads test fixtures at require-time — must run in Node.js runtime
export const runtime = "nodejs";

import { upsertUserResume } from "@/lib/db-queries";
import { upsertResumeVector } from "@/lib/vector-store";
import { logger } from "@/lib/logger";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

async function generateNvidiaEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${NVIDIA_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: "nvidia/nv-embedqa-e5-v5",
      encoding_format: "float",
      input_type: "passage",
      truncate: "END",
    }),
  });
  if (!response.ok) {
    throw new Error(`NVIDIA embedding error: ${await response.text()}`);
  }
  const data = await response.json();
  return data.data[0].embedding;
}

async function extractResumeFields(resumeText: string): Promise<string> {
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages: [
        {
          role: "user",
          content: `You are a resume parser. Extract structured information from the resume text below.
Return ONLY a valid JSON object with these exact fields — no markdown, no extra text:
{
  "role": "candidate's current or most recent job title, or target role if stated",
  "experience_level": "one of exactly: junior, mid, senior",
  "skills": ["array", "of", "technical", "skills", "mentioned", "in", "resume"],
  "summary": "2-3 sentence professional summary of the candidate"
}

Resume text:
${resumeText.substring(0, 8000)}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });
  if (!response.ok) {
    throw new Error(`NVIDIA LLM error: ${await response.text()}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userid = formData.get("userid") as string | null;

    if (!file || !userid) {
      return Response.json(
        { success: false, error: "Missing file or userid" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { success: false, error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const mimeType = file.type;
    const fileName = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Step 1: Extract raw text ─────────────────────────────────────────────
    let rawText: string;

    if (
      mimeType === "application/pdf" ||
      fileName.toLowerCase().endsWith(".pdf")
    ) {
      // pdf-parse v1 exports a plain CJS function — require() is reliable here
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);
      rawText = data.text;
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.toLowerCase().endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    } else {
      return Response.json(
        { success: false, error: "Unsupported file type. Please upload a PDF or DOCX." },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length < 50) {
      return Response.json(
        { success: false, error: "Could not extract text from the file. Please ensure it is a valid resume." },
        { status: 422 }
      );
    }

    logger.info(`[Resume] Extracted ${rawText.length} characters from ${fileName}`);

    // ── Step 2: NVIDIA structured extraction ────────────────────────────────
    const extractedJson = await extractResumeFields(rawText);

    let parsedRole: string | null = null;
    let parsedLevel: string | null = null;
    let parsedSkills: string[] = [];
    let parsedSummary: string | null = null;

    try {
      // Strip possible markdown code fences
      const cleaned = extractedJson
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      parsedRole = parsed.role ?? null;
      parsedLevel = ["junior", "mid", "senior"].includes(parsed.experience_level)
        ? parsed.experience_level
        : null;
      parsedSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
      parsedSummary = parsed.summary ?? null;
    } catch {
      logger.warn("[Resume] NVIDIA LLM returned invalid JSON for extraction, using null values");
    }

    // ── Step 3: Generate embedding ───────────────────────────────────────────
    // nv-embedqa-e5-v5 produces 1024-dimensional vectors — matching our Upstash index.
    const textToEmbed = rawText.substring(0, 4000);
    const embedding = await generateNvidiaEmbedding(textToEmbed);


    
    // ── Step 4: Upsert into Upstash Vector ────────────────────────────────────
    await upsertResumeVector(userid, embedding, {
      raw_text: rawText,
      parsed_role: parsedRole,
      parsed_level: parsedLevel,
      parsed_skills: parsedSkills,
      parsed_summary: parsedSummary,
      file_name: fileName,
      updated_at: new Date().toISOString(),
    });
    

    // ── Step 5: Upsert into MySQL ─────────────────────────────────────────────
    const savedResume = await upsertUserResume({
      user_id: userid,
      raw_text: rawText,
      parsed_role: parsedRole,
      parsed_level: parsedLevel,
      parsed_skills: parsedSkills,
      parsed_summary: parsedSummary,
      file_name: fileName,
    });

    logger.info(`[Resume] Successfully processed resume for user: ${userid}`);

    return Response.json({
      success: true,
      resume: {
        parsedRole: savedResume.parsed_role,
        parsedLevel: savedResume.parsed_level,
        parsedSkills: savedResume.parsed_skills ?? [],
        parsedSummary: savedResume.parsed_summary,
        fileName: savedResume.file_name,
        updatedAt: savedResume.updated_at,
      },
    });
  } catch (error) {
    logger.error("[Resume] Upload error:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process resume. Please try again.",
      },
      { status: 500 }
    );
  }
}
