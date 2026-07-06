"use client";

import { useRef, useState, DragEvent } from "react";
import {
  UploadCloud,
  FileText,
  RefreshCw,
  Loader2,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

interface ResumeData {
  parsedRole: string | null;
  parsedLevel: string | null;
  parsedSkills: string[];
  parsedSummary: string | null;
  fileName: string | null;
  updatedAt: string;
}

interface ResumeUploadSectionProps {
  userId: string;
  initialResume?: ResumeData | null;
}

const MAX_SIZE_MB = 5;

const ResumeUploadSection = ({ userId, initialResume }: ResumeUploadSectionProps) => {
  const [resume, setResume] = useState<ResumeData | null>(initialResume ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (
      !allowed.includes(file.type) &&
      !file.name.endsWith(".pdf") &&
      !file.name.endsWith(".docx")
    ) {
      toast.error("Please upload a PDF or DOCX file.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userid", userId);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      setResume(result.resume);
      toast.success("Resume uploaded and parsed successfully!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload resume. Please try again."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const skills = resume?.parsedSkills ?? [];
  const visibleSkills = skills.slice(0, 6);
  const remainingSkills = skills.length - visibleSkills.length;

  return (
    <div className="panel overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {resume ? (
          <motion.div
            key="uploaded"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            {/* File row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="icon-tile size-11 shrink-0">
                  <FileText className="size-5 text-accent" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-strong">
                    {resume.fileName ?? "Resume"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                    <BadgeCheck
                      className="size-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    Parsed · {dayjs(resume.updatedAt).format("MMM D, YYYY")}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-hairline px-3 text-xs font-medium text-soft transition-colors duration-200 hover:border-hairline-strong hover:text-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                )}
                {isUploading ? "Uploading…" : "Replace"}
              </button>
            </div>

            {/* Parsed details */}
            {(resume.parsedRole || skills.length > 0) && (
              <div className="mt-5 border-t border-hairline pt-4">
                {resume.parsedRole && (
                  <p className="text-xs text-faint">
                    Detected role{" "}
                    <span className="ml-1 font-medium capitalize text-strong">
                      {resume.parsedRole}
                    </span>
                    {resume.parsedLevel && (
                      <span className="ml-1.5 rounded-full border border-hairline bg-raise px-2 py-0.5 text-[11px] font-medium capitalize text-body">
                        {resume.parsedLevel}
                      </span>
                    )}
                  </p>
                )}

                {visibleSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {visibleSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-hairline bg-raise px-2.5 py-1 text-[11px] font-medium text-body"
                      >
                        {skill}
                      </span>
                    ))}
                    {remainingSkills > 0 && (
                      <span className="rounded-full px-2 py-1 text-[11px] text-faint">
                        +{remainingSkills} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="empty"
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            disabled={isUploading}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center transition-colors duration-200 disabled:cursor-not-allowed",
              isDragging ? "bg-accent/5" : "hover:bg-hover"
            )}
          >
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-full border transition-colors duration-200",
                isDragging
                  ? "border-accent/50 bg-accent/10"
                  : "border-hairline bg-raise"
              )}
            >
              {isUploading ? (
                <Loader2 className="size-5 animate-spin text-accent" aria-hidden="true" />
              ) : (
                <UploadCloud
                  className={cn(
                    "size-5 transition-colors duration-200",
                    isDragging ? "text-accent" : "text-soft"
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-strong">
                {isUploading
                  ? "Parsing your resume…"
                  : isDragging
                    ? "Drop to upload"
                    : "Upload your resume"}
              </p>
              <p className="mt-1 text-xs text-faint">
                Drag &amp; drop or click — PDF or DOCX, up to {MAX_SIZE_MB}MB
              </p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload resume file"
      />
    </div>
  );
};

export default ResumeUploadSection;
