import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { Settings, Sparkles } from "lucide-react";

import DisplayTechIcons from "@/components/DisplayTechIcons";
import InterviewSession from "@/components/interview/InterviewSession";
import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import {
  getUserFeedbackCount,
  getUserPremiumStatus,
} from "@/lib/actions/premium.action";
import { hasUserVapiCredentials } from "@/lib/actions/vapi.action";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const clerkUser = await currentUser();
  if (!clerkUser?.id) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const [feedback, isPremium, feedbackCount, hasVapiCredentials] =
    await Promise.all([
      getFeedbackByInterviewId({ interviewId: id, userId: clerkUser.id }),
      getUserPremiumStatus(clerkUser.id),
      getUserFeedbackCount(clerkUser.id),
      hasUserVapiCredentials(clerkUser.id),
    ]);

  const limitReached =
    !isPremium && !hasVapiCredentials && feedbackCount >= 1 && !feedback;

  if (limitReached) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-16">
        <div className="panel flex max-w-lg flex-col items-center gap-6 px-10 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 className="display text-2xl">Free plan limit reached</h2>
            <p className="mt-3 leading-relaxed text-soft">
              You&apos;ve taken your free interview. Connect your own Vapi key
              or upgrade to Premium for unlimited interviews.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/settings/vapi" className="btn-quiet !h-10 text-sm">
              <Settings className="size-4" aria-hidden="true" />
              Use my Vapi key
            </Link>
            <button type="button" className="btn-accent !h-10 text-sm">
              Upgrade to Premium
            </button>
          </div>
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

  return (
    <InterviewSession
      interviewId={id}
      role={interview.role}
      type={interview.type}
      level={interview.level}
      coverImage={interview.coverImage || null}
      questionCount={interview.questions.length}
      questions={interview.questions}
      feedbackId={feedback?.id}
      userName={clerkUser.firstName || clerkUser.username || "User"}
      userId={clerkUser.id}
      userImage={clerkUser.imageUrl}
      techIcons={<DisplayTechIcons techStack={interview.techstack} />}
    />
  );
};

export default InterviewDetails;
