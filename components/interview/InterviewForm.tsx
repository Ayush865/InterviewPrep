"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileText, Minus, Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import TechstackMultiSelect from "./TechstackMultiSelect";
import CompanySelect from "./CompanySelect";
import InterviewSuccessModal from "./InterviewSuccessModal";

import {
  interviewFormSchema,
  type InterviewFormData,
} from "@/lib/validations/interview";
import { interviewLevels, interviewTypes, interviewRoles } from "@/constants";

interface ParsedResumeData {
  parsedRole: string | null;
  parsedLevel: string | null;
  parsedSkills: string[];
  parsedSummary: string | null;
  fileName: string | null;
  updatedAt: string;
}

interface InterviewFormProps {
  userId: string;
  resumeData?: ParsedResumeData | null;
}

const InterviewForm = ({ userId, resumeData }: InterviewFormProps) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedInterviewId, setGeneratedInterviewId] = useState<string | null>(null);
  const [useResume, setUseResume] = useState(false);

  const form = useForm<InterviewFormData>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues: {
      level: "",
      type: "",
      role: "",
      techstack: [],
      amount: 5,
      company_name: undefined,
      use_resume: false,
    },
  });

  const amount = form.watch("amount");

  const handleAmountChange = (delta: number) => {
    const newAmount = Math.max(3, Math.min(15, amount + delta));
    form.setValue("amount", newAmount);
  };

  const handleResumeToggle = () => {
    const next = !useResume;
    setUseResume(next);
    form.setValue("use_resume", next);

    if (next && resumeData) {
      // Pre-fill fields from resume as a convenience hint (still editable)
      form.setValue("type", "technical");
      if (resumeData.parsedRole) {
        const matchedRole = interviewRoles.find(
          (r) => r.value.toLowerCase() === resumeData.parsedRole!.toLowerCase()
        );
        if (matchedRole) form.setValue("role", matchedRole.value);
      }
      if (resumeData.parsedLevel) {
        const matchedLevel = interviewLevels.find(
          (l) => l.value === resumeData.parsedLevel
        );
        if (matchedLevel) form.setValue("level", matchedLevel.value);
      }
      if (resumeData.parsedSkills.length > 0) {
        form.setValue("techstack", resumeData.parsedSkills.slice(0, 10));
      }
    }
  };

  const onSubmit = async (data: InterviewFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          role: data.role,
          level: data.level,
          techstack: data.techstack.join(", "),
          amount: data.amount,
          userid: userId,
          company_name: data.company_name || null,
          use_resume: data.use_resume || false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate interview");
      }

      if (result.success && result.interviewId) {
        setGeneratedInterviewId(result.interviewId);
        setShowSuccessModal(true);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate interview. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    if (generatedInterviewId) {
      router.push(`/interview/${generatedInterviewId}`);
    }
  };

  return (
    <>
      <div className="panel w-full p-8 max-sm:p-6">
        {/* Resume context toggle — only shown when a resume exists */}
        {resumeData && (
          <div className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-hairline bg-raise p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-raise">
                <FileText className="size-4 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-strong">
                  Use resume context
                </p>
                <p className="text-xs text-faint">
                  Tailor questions to your background
                  {resumeData.fileName ? ` — ${resumeData.fileName}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useResume}
              aria-label="Use resume context"
              onClick={handleResumeToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                useResume ? "bg-accent" : "bg-hairline-strong"
              }`}
            >
              <span
                className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  useResume ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Role Select */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-body">
                      Role
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="field-trigger">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-hairline bg-surface-overlay">
                        {interviewRoles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Level Select */}
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-body">
                      Experience level
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="field-trigger">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-hairline bg-surface-overlay">
                        {interviewLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Type Select */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-body">
                    Interview type
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="field-trigger">
                        <SelectValue placeholder="Select interview type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-hairline bg-surface-overlay">
                      {interviewTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company Select */}
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-body">
                    Target company{" "}
                    <span className="font-normal text-faint">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <CompanySelect value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Techstack Multi-Select */}
            <FormField
              control={form.control}
              name="techstack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-body">
                    Tech stack
                  </FormLabel>
                  <FormControl>
                    <TechstackMultiSelect
                      selected={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question count stepper */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-body">
                    Number of questions
                  </FormLabel>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAmountChange(-1)}
                      disabled={amount <= 3}
                      aria-label="Fewer questions"
                      className="size-12 rounded-xl border-hairline bg-raise hover:border-hairline-strong hover:bg-hover"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </Button>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="field-trigger w-20 text-center"
                        min={3}
                        max={15}
                        aria-label="Number of questions"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAmountChange(1)}
                      disabled={amount >= 15}
                      aria-label="More questions"
                      className="size-12 rounded-xl border-hairline bg-raise hover:border-hairline-strong hover:bg-hover"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                    <span className="ml-1 text-sm text-faint">
                      3–15 questions
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              className="btn-accent h-12 w-full text-base"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Generating interview…
                </>
              ) : (
                "Generate interview"
              )}
            </button>
          </form>
        </Form>
      </div>

      <InterviewSuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
      />
    </>
  );
};

export default InterviewForm;
