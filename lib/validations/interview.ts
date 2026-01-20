import { z } from "zod";

export const interviewFormSchema = z.object({
  level: z.string().min(1, "Please select an experience level"),
  type: z.string().min(1, "Please select an interview type"),
  role: z.string().min(1, "Please select a role"),
  techstack: z.array(z.string()).min(1, "Please select at least one technology"),
  amount: z.number().min(3, "Minimum 3 questions").max(15, "Maximum 15 questions"),
});

export type InterviewFormData = z.infer<typeof interviewFormSchema>;
