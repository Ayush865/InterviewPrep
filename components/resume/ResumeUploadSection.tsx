"use client";

import { useRef, useState } from "react";
import { Upload, FileText, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

const ResumeUploadSection = ({ userId, initialResume }: ResumeUploadSectionProps) => {
  const [resume, setResume] = useState<ResumeData | null>(initialResume ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".docx")) {
      toast.error("Please upload a PDF or DOCX file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
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
        error instanceof Error ? error.message : "Failed to upload resume. Please try again."
      );
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be re-uploaded if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="card-border rounded-xl p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-200" />
          Resume
        </h3>
        {resume && (
          <Button
            variant="ghost"
            size="sm"
            className="text-light-400 hover:text-white gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-upload
          </Button>
        )}
      </div>

      {resume ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{resume.fileName ?? "Resume"}</p>
              <p className="text-xs text-light-400">
                Uploaded {dayjs(resume.updatedAt).format("MMM D, YYYY")}
              </p>
            </div>
          </div>
          {resume.parsedRole && (
            <p className="text-xs text-light-400">
              Role detected: <span className="text-white">{resume.parsedRole}</span>
            </p>
          )}
          {resume.parsedSkills.length > 0 && (
            <p className="text-xs text-light-400 line-clamp-1">
              Skills: <span className="text-white">{resume.parsedSkills.slice(0, 5).join(", ")}{resume.parsedSkills.length > 5 ? ` +${resume.parsedSkills.length - 5} more` : ""}</span>
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full border border-dashed border-dark-300 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary-200 hover:bg-dark-200/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-primary-200 animate-spin" />
          ) : (
            <Upload className="h-8 w-8 text-light-400" />
          )}
          <span className="text-sm text-light-400">
            {isUploading ? "Processing resume..." : "Upload PDF or DOCX (max 5MB)"}
          </span>
        </button>
      )}

      {isUploading && resume && (
        <div className="mt-3 flex items-center gap-2 text-xs text-light-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading new resume...
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ResumeUploadSection;
