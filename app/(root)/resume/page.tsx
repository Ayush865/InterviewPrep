/**
 * app/(root)/resume/page.tsx
 *
 * Resume hub: upload/replace, and AI review with ATS-style scoring
 * (Pro: 1/month, Elite: unlimited).
 */

import dayjs from "dayjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileSearch,
} from "lucide-react";

import ResumeUploadSection from "@/components/resume/ResumeUploadSection";
import ResumeReviewButton from "@/components/resume/ResumeReviewButton";
import UpgradeButton from "@/components/UpgradeButton";
import Reveal from "@/components/motion/Reveal";
import { getResumeByUserId } from "@/lib/actions/resume.action";
import { getUserEntitlements } from "@/lib/actions/premium.action";
import { getLatestResumeReview } from "@/lib/db-queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default async function ResumePage() {
  const clerkUser = await currentUser();
  if (!clerkUser?.id) redirect("/sign-in");

  const [resume, entitlements, latestReview] = await Promise.all([
    getResumeByUserId(clerkUser.id),
    getUserEntitlements(clerkUser.id),
    getLatestResumeReview(clerkUser.id),
  ]);

  const reviewLimit = entitlements.features.resumeReviewsPerMonth;
  const reviewsUsed = entitlements.resumeReviewsUsed;
  const canReview =
    reviewLimit === null ? true : reviewLimit > 0 && reviewsUsed < reviewLimit;
  const isPaidFeature = reviewLimit !== 0;

  return (
    <div className="mx-auto w-full max-w-2xl pb-24 pt-12 max-sm:pt-8">
      <header>
        <h1 className="display text-3xl">Resume</h1>
        <p className="mt-2 text-soft">
          Your resume powers tailored interviews — and the AI review shows
          you how recruiters will read it.
        </p>
      </header>

      <div className="mt-8">
        <ResumeUploadSection userId={clerkUser.id} initialResume={resume} />
      </div>

      {/* AI review */}
      <Reveal className="panel mt-6 p-7 max-sm:p-6">
        <div className="flex items-start justify-between gap-4 max-sm:flex-col">
          <div>
            <h2 className="display text-lg">AI resume review</h2>
            <p className="mt-1 text-sm text-soft">
              ATS-style score, specific issues, and rewritten bullets.
            </p>
            {isPaidFeature && reviewLimit !== null && (
              <p className="mt-1 text-xs text-faint">
                {reviewsUsed}/{reviewLimit} used this month
              </p>
            )}
          </div>

          {!resume ? (
            <p className="text-sm text-faint">Upload a resume first.</p>
          ) : isPaidFeature ? (
            canReview ? (
              <ResumeReviewButton />
            ) : (
              <UpgradeButton plan="elite" className="!h-10 shrink-0 text-sm">
                Unlimited with Elite
              </UpgradeButton>
            )
          ) : (
            <UpgradeButton className="!h-10 shrink-0 text-sm">
              Unlock with Pro
            </UpgradeButton>
          )}
        </div>

        {/* Latest review */}
        {latestReview && isPaidFeature && (
          <div className="mt-6 border-t border-hairline pt-6">
            <div className="flex items-start justify-between gap-6 max-sm:flex-col">
              <div>
                <p className="text-sm text-faint">
                  Reviewed {dayjs(latestReview.created_at).format("MMM D, YYYY")}
                  {latestReview.target_role
                    ? ` · for ${latestReview.target_role}`
                    : ""}
                </p>
                <p className="mt-2 leading-relaxed text-body">
                  {latestReview.summary}
                </p>
              </div>
              <div className="text-right max-sm:text-left">
                <p className="text-sm text-faint">ATS score</p>
                <p
                  className={cn(
                    "text-4xl font-semibold tracking-tight",
                    scoreTone(latestReview.ats_score)
                  )}
                >
                  {latestReview.ats_score}
                  <span className="text-lg font-normal text-faint">/100</span>
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-strong">
                  What works
                </h3>
                <ul className="mt-3 flex list-none flex-col gap-2.5">
                  {latestReview.strengths.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-body">
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-strong">
                  What hurts you
                </h3>
                <ul className="mt-3 flex list-none flex-col gap-2.5">
                  {latestReview.issues.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-body">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {latestReview.bullet_rewrites.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-strong">
                  Bullet rewrites
                </h3>
                <div className="mt-3 flex flex-col gap-3">
                  {latestReview.bullet_rewrites.map((rewrite, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-hairline bg-raise p-4"
                    >
                      <p className="text-sm leading-relaxed text-faint line-through decoration-hairline-strong">
                        {rewrite.original}
                      </p>
                      <p className="mt-2 flex gap-2 text-sm leading-relaxed text-body">
                        <ArrowRight
                          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                        {rewrite.improved}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teaser for free users */}
        {!isPaidFeature && (
          <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-6">
            <FileSearch className="size-5 shrink-0 text-faint" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-soft">
              Pro members get an ATS-style score, a list of exactly what
              hurts their resume, and rewritten bullets — tuned to their
              target role.
            </p>
          </div>
        )}
      </Reveal>

      <p className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-faint transition-colors duration-200 hover:text-strong"
        >
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
