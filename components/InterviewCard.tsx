import dayjs from "dayjs";
import Image from "next/image";
import { Calendar, Gauge, CheckCircle2 } from "lucide-react";

import DisplayTechIcons from "./DisplayTechIcons";
import TakeInterviewButton from "./TakeInterviewButton";
import type { FeedbackSummary } from "@/lib/actions/general.action";

interface InterviewCardComponentProps {
  interviewId: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
  coverImage?: string;
  isTaken?: boolean;
  feedback: FeedbackSummary | null;
  isPremium: boolean;
  hasVapiCredentials: boolean;
  feedbackCount: number;
}

const InterviewCard = ({
  interviewId,
  role,
  type,
  techstack,
  createdAt,
  coverImage,
  isTaken = false,
  feedback,
  isPremium,
  hasVapiCredentials,
  feedbackCount,
}: InterviewCardComponentProps) => {
  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  return (
    <article className="panel panel-hover group relative flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] p-2">
          <Image
            src={coverImage || "/covers/Amazon.svg"}
            alt=""
            width={40}
            height={40}
            className="size-8 object-contain"
          />
        </div>

        <div className="flex items-center gap-2">
          {isTaken && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Taken
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-xs font-medium capitalize text-zinc-300">
            {normalizedType}
          </span>
        </div>
      </div>

      <h3 className="mt-5 text-lg font-semibold capitalize tracking-tight text-white">
        {role} Interview
      </h3>

      <div className="mt-2 flex items-center gap-4 text-sm text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" aria-hidden="true" />
          {formattedDate}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Gauge className="size-3.5" aria-hidden="true" />
          {feedback?.totalScore != null ? `${feedback.totalScore}/100` : "Not scored"}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-400">
        {feedback?.finalAssessment ||
          "You haven't taken this interview yet. Take it to get instant AI feedback."}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <DisplayTechIcons techStack={techstack} />

        <TakeInterviewButton
          isPremium={isPremium}
          hasVapiCredentials={hasVapiCredentials}
          feedbackCount={feedbackCount}
          interviewId={interviewId}
          hasFeedback={!!feedback}
        />
      </div>
    </article>
  );
};

export default InterviewCard;
