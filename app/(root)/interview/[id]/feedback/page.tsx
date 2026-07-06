import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  ArrowLeft,
} from "lucide-react";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import Reveal from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBarTone(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const clerkUser = await currentUser();
  if (!clerkUser?.id) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: clerkUser.id,
  });
  if (!feedback) redirect(`/interview/${id}`);

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 pt-12 max-sm:pt-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-faint transition-colors duration-200 hover:text-strong"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      {/* Header + overall score */}
      <Reveal className="panel mt-6 p-8 max-sm:p-6">
        <div className="flex items-start justify-between gap-6 max-sm:flex-col">
          <div className="flex items-center gap-4">
            <div className="icon-tile size-12 shrink-0 p-2">
              <Image
                src={interview.coverImage || "/covers/Amazon.svg"}
                alt=""
                width={40}
                height={40}
                className="size-8 object-contain"
              />
            </div>
            <div>
              <h1 className="display text-2xl capitalize">
                {interview.role} Interview
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-faint">
                <Calendar className="size-3.5" aria-hidden="true" />
                {dayjs(feedback.createdAt).format("MMM D, YYYY · h:mm A")}
              </p>
            </div>
          </div>

          <div className="text-right max-sm:text-left">
            <p className="text-sm text-faint">Overall score</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">
              <span className={scoreTone(feedback.totalScore)}>
                {feedback.totalScore}
              </span>
              <span className="text-lg font-normal text-faint"> / 100</span>
            </p>
          </div>
        </div>

        {feedback.finalAssessment && (
          <p className="mt-6 border-t border-hairline pt-5 leading-relaxed text-body">
            {feedback.finalAssessment}
          </p>
        )}
      </Reveal>

      {/* Category breakdown */}
      <Reveal delay={0.06} className="panel mt-4 p-8 max-sm:p-6">
        <h2 className="display text-lg">Breakdown</h2>
        <div className="mt-6 flex flex-col gap-6">
          {feedback.categoryScores?.map((category) => (
            <div key={category.name}>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium text-strong">
                  {category.name}
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    scoreTone(category.score)
                  )}
                >
                  {category.score}
                  <span className="font-normal text-faint">/100</span>
                </p>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-raise"
                role="progressbar"
                aria-valuenow={category.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${category.name} score`}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    scoreBarTone(category.score)
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, category.score))}%` }}
                />
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-soft">
                {category.comment}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Strengths & improvements */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Reveal delay={0.1} className="panel h-full p-7 max-sm:p-6">
          <h2 className="display text-lg">Strengths</h2>
          <ul className="mt-4 flex list-none flex-col gap-3">
            {feedback.strengths?.map((strength) => (
              <li key={strength} className="flex gap-2.5 text-sm leading-relaxed text-body">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {strength}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.14} className="panel h-full p-7 max-sm:p-6">
          <h2 className="display text-lg">Areas to improve</h2>
          <ul className="mt-4 flex list-none flex-col gap-3">
            {feedback.areasForImprovement?.map((area) => (
              <li key={area} className="flex gap-2.5 text-sm leading-relaxed text-body">
                <TrendingUp
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                {area}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center justify-center gap-3 max-sm:flex-col">
        <Link href={`/interview/${id}`} className="btn-accent max-sm:w-full">
          <RotateCcw className="size-4" aria-hidden="true" />
          Retake interview
        </Link>
        <Link href="/" className="btn-quiet max-sm:w-full">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};

export default Feedback;
