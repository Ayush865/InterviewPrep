"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileText } from "lucide-react";

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
import { Minus, Plus, Loader2 } from "lucide-react";

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
      <div className="card-border p-6 rounded-xl w-full max-w-[540px] mx-auto">
        <h3 className="text-xl font-semibold mb-6">Generate Interview</h3>

        {/* Generate from Resume toggle — only shown when resume exists */}
        {resumeData && (
          <div className="mb-6 p-3 rounded-lg bg-dark-200 border border-dark-300 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-200 shrink-0" />
              <div>
                <p className="text-sm font-medium">Use Resume Context</p>
                <p className="text-xs text-light-400">
                  Gemini will tailor questions to your background
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResumeToggle}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                useResume ? "bg-primary-200" : "bg-dark-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useResume ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Role Select */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-dark-200 border-dark-200">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-dark-200 border-dark-200">
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
                  <FormLabel>Experience Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-dark-200 border-dark-200">
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-dark-200 border-dark-200">
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

            {/* Type Select */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interview Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-dark-200 border-dark-200">
                        <SelectValue placeholder="Select interview type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-dark-200 border-dark-200">
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
                  <FormLabel>Target Company <span className="text-light-400 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <CompanySelect
                      value={field.value}
                      onChange={field.onChange}
                    />
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
                  <FormLabel>Tech Stack</FormLabel>
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

            {/* Amount with +/- Controls */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Questions</FormLabel>
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAmountChange(-1)}
                      disabled={amount <= 3}
                      className="bg-dark-200 border-dark-200"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-20 text-center bg-dark-200 border-dark-200"
                        min={3}
                        max={15}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleAmountChange(1)}
                      disabled={amount >= 15}
                      className="bg-dark-200 border-dark-200"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Interview...
                </>
              ) : (
                "Generate Interview"
              )}
            </Button>
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
