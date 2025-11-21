import Image from "next/image";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import Agent from "@/components/Agent";
import { getRandomInterviewCover } from "@/lib/utils";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const clerkUser = await currentUser();

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: clerkUser?.id!,
  });

  // Check premium limits
  const { getUserFeedbackCount, getUserPremiumStatus } = await import("@/lib/actions/premium.action");
  const isPremium = await getUserPremiumStatus(clerkUser?.id!);
  const feedbackCount = await getUserFeedbackCount(clerkUser?.id!);
  
  const hasTakenInterview = !!feedback;
  
  // Debug logging
  console.log('[INTERVIEW PAGE] Limit Check:', {
    userId: clerkUser?.id,
    interviewId: id,
    isPremium,
    feedbackCount,
    hasTakenInterview,
  });
  
  // Non-premium users can only take 1 interview total
  // Block if: not premium AND has taken 1+ interviews
  const limitReached = !isPremium && feedbackCount >= 1;

  console.log('[INTERVIEW PAGE] Limit reached?', limitReached);

  if (limitReached) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <h2 className="text-2xl font-bold text-white">Free Plan Limit Reached</h2>
        <p className="text-gray-400 text-center max-w-md">
          You have already taken 1 interview. Upgrade to Premium to take unlimited interviews.
        </p>
        <div className="flex gap-4">
            <a href="/" className="px-4 py-2 bg-dark-300 rounded-lg text-white hover:bg-dark-400 transition-colors">
              Go Home
            </a>
            {/* Placeholder for upgrade button */}
            <button className="px-4 py-2 bg-slate-purple rounded-lg text-white hover:bg-orange transition-colors">
              Upgrade to Premium
            </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-row gap-4 justify-between">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col">
          <div className="flex flex-row gap-4 items-center">
            <Image
              src={interview.coverImage || "/covers/Amazon.svg"}
              alt="cover-image"
              width={40}
              height={40}
              className="object-cover size-[40px]"
            />
            <h3 className="capitalize">{interview.role} Interview</h3>
          </div>

          <DisplayTechIcons techStack={interview.techstack} />
        </div>

        <p className="bg-slate-purple px-4 py-2 rounded-lg h-fit">
          {interview.type}
        </p>
      </div>

      <Agent
        userName={clerkUser?.firstName || clerkUser?.username || "User"}
        userId={clerkUser?.id}
        userImage={clerkUser?.imageUrl}
        interviewId={id}
        type="interview"
        questions={interview.questions}
        feedbackId={feedback?.id}
      />
    </>
  );
};

export default InterviewDetails;
