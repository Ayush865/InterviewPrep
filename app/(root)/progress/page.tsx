/**
 * app/(root)/progress/page.tsx
 *
 * Progress dashboard (Pro feature): score trend, category averages,
 * readiness per role, session history.
 */

import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { TrendingUp, Target, ArrowRight, LineChart } from "lucide-react";

import ScoreTrendChart from "@/components/progress/ScoreTrendChart";
import CategoryBars from "@/components/progress/CategoryBars";
import UpgradeButton from "@/components/UpgradeButton";
import Reveal from "@/components/motion/Reveal";
import { getProgressSessions } from "@/lib/actions/general.action";
import { getUserEntitlements } from "@/lib/actions/premium.action";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default async function ProgressPage() {
  const clerkUser = await currentUser();
  if (!clerkUser?.id) redirect("/sign-in");

  const entitlements = await getUserEntitlements(clerkUser.id);

  // Feature gate: progress dashboard is a paid feature
  if (!entitlements.features.progress) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="panel flex max-w-lg flex-col items-center gap-6 px-10 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
            <LineChart className="size-5 text-accent" aria-hidden="true" />
          </div>
          <div>
            <h1 className="display text-2xl">Track your improvement</h1>
            <p className="mt-3 leading-relaxed text-soft">
              See your score trend across sessions, category-by-category
              averages, your focus areas, and how ready you are for your
              target role. Available on Pro.
            </p>
          </div>
          <UpgradeButton className="!h-10 text-sm" />
          <Link
            href="/"
            className="text-sm text-faint transition-colors duration-200 hover:text-strong"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const sessions = await getProgressSessions(clerkUser.id);

  if (sessions.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl pb-24 pt-12 max-sm:pt-8">
        <h1 className="display text-3xl">Progress</h1>
        <div className="panel mt-8 flex flex-col items-center gap-4 px-8 py-14 text-center">
          <TrendingUp className="size-6 text-faint" aria-hidden="true" />
          <div>
            <p className="font-medium text-strong">No sessions yet</p>
            <p className="mt-1 text-sm text-faint">
              Complete your first practice interview and your progress will
              show up here.
            </p>
          </div>
          <Link href="/interview" className="btn-accent !h-10 text-sm">
            Create an interview
          </Link>
        </div>
      </div>
    );
  }

  // ---- Derived metrics ----
  const latest = sessions[sessions.length - 1];
  const first = sessions[0];
  const delta = latest.totalScore - first.totalScore;

  // Category averages across all sessions
  const categoryTotals = new Map<string, { sum: number; count: number }>();
  for (const session of sessions) {
    for (const category of session.categoryScores ?? []) {
      const entry = categoryTotals.get(category.name) ?? { sum: 0, count: 0 };
      entry.sum += category.score;
      entry.count += 1;
      categoryTotals.set(category.name, entry);
    }
  }
  const categoryAverages = [...categoryTotals.entries()]
    .map(([name, { sum, count }]) => ({
      name,
      average: Math.round(sum / count),
      sessions: count,
    }))
    .sort((a, b) => b.average - a.average);
  const weakest =
    categoryAverages.length > 0
      ? categoryAverages[categoryAverages.length - 1].name
      : null;

  // Readiness per role: average of the last 3 sessions for that role
  const byRole = new Map<string, ProgressSessionScores[]>();
  interface ProgressSessionScores {
    totalScore: number;
    createdAt: string;
  }
  for (const session of sessions) {
    const list = byRole.get(session.role) ?? [];
    list.push({ totalScore: session.totalScore, createdAt: session.createdAt });
    byRole.set(session.role, list);
  }
  const readiness = [...byRole.entries()]
    .map(([role, list]) => {
      const recent = list.slice(-3);
      return {
        role,
        score: Math.round(
          recent.reduce((sum, s) => sum + s.totalScore, 0) / recent.length
        ),
        sessions: list.length,
        lastAt: list[list.length - 1].createdAt,
      };
    })
    .sort((a, b) => dayjs(b.lastAt).valueOf() - dayjs(a.lastAt).valueOf())
    .slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 pt-12 max-sm:pt-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">Progress</h1>
          <p className="mt-2 text-soft">
            {sessions.length} scored {sessions.length === 1 ? "session" : "sessions"}
            {delta !== 0 && sessions.length > 1 && (
              <>
                {" "}
                ·{" "}
                <span
                  className={
                    delta > 0
                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                      : "font-medium text-red-600 dark:text-red-400"
                  }
                >
                  {delta > 0 ? "+" : ""}
                  {delta} pts
                </span>{" "}
                since your first session
              </>
            )}
          </p>
        </div>
        <p className="text-right">
          <span className="block text-sm text-faint">Latest score</span>
          <span
            className={cn(
              "text-3xl font-semibold tracking-tight",
              scoreTone(latest.totalScore)
            )}
          >
            {latest.totalScore}
          </span>
        </p>
      </header>

      {/* Readiness */}
      {readiness.length > 0 && (
        <Reveal className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {readiness.map((item) => (
            <div key={item.role} className="panel p-5">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-faint">
                <Target className="size-3.5" aria-hidden="true" />
                Readiness
              </p>
              <p className="mt-2 truncate text-sm font-medium capitalize text-strong">
                {item.role}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                <span className={scoreTone(item.score)}>{item.score}%</span>
              </p>
              <p className="mt-0.5 text-xs text-faint">
                based on {Math.min(item.sessions, 3)} recent{" "}
                {Math.min(item.sessions, 3) === 1 ? "session" : "sessions"}
              </p>
            </div>
          ))}
        </Reveal>
      )}

      {/* Score trend */}
      <Reveal delay={0.05} className="panel mt-4 p-7 max-sm:p-5">
        <h2 className="display text-lg">Score trend</h2>
        <div className="mt-4">
          <ScoreTrendChart
            points={sessions.map((session) => ({
              score: session.totalScore,
              label: `${session.role} interview`,
              date: session.createdAt,
            }))}
          />
        </div>
      </Reveal>

      {/* Category averages */}
      <Reveal delay={0.08} className="panel mt-4 p-7 max-sm:p-5">
        <h2 className="display text-lg">By category</h2>
        <p className="mt-1 text-sm text-faint">
          Average across all sessions — your lowest category is the fastest
          way to raise your overall score.
        </p>
        <div className="mt-5">
          <CategoryBars categories={categoryAverages} weakest={weakest} />
        </div>
      </Reveal>

      {/* Session history (also the accessible table view of the trend) */}
      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="display text-xl">
          Session history
        </h2>
        <div className="mt-4 flex flex-col gap-2">
          {[...sessions].reverse().map((session) => (
            <Link
              key={session.feedbackId}
              href={`/interview/${session.interviewId}/feedback`}
              className="panel panel-hover group flex items-center gap-4 p-4"
            >
              <div className="icon-tile size-10 shrink-0 p-1.5">
                <Image
                  src={session.coverImage || "/covers/Amazon.svg"}
                  alt=""
                  width={32}
                  height={32}
                  className="size-7 object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-strong">
                  {session.role} interview
                  {session.companyName ? ` · ${session.companyName}` : ""}
                </p>
                <p className="text-xs text-faint">
                  {dayjs(session.createdAt).format("MMM D, YYYY")}
                </p>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  scoreTone(session.totalScore)
                )}
              >
                {session.totalScore}
                <span className="font-normal text-faint">/100</span>
              </p>
              <ArrowRight
                className="size-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-strong"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
