import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";

import { Button } from "./ui/button";
import DisplayTechIcons from "./DisplayTechIcons";

import { cn, getRandomInterviewCover } from "@/lib/utils";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";
import { getUserPremiumStatus, getUserFeedbackCount } from "@/lib/actions/premium.action";
import TakeInterviewButton from "./TakeInterviewButton";

const InterviewCard = async ({
  interviewId,
  userId,
  role,
  type,
  techstack,
  createdAt,
  coverImage,
  isTaken = false,
}: InterviewCardProps) => {
  const feedback =
    userId && interviewId
      ? await getFeedbackByInterviewId({
          interviewId,
          userId,
        })
      : null;

  // Fetch premium status and feedback count for limit checking
  const [isPremium, feedbackCount] = userId
    ? await Promise.all([
        getUserPremiumStatus(userId),
        getUserFeedbackCount(userId),
      ])
    : [false, 0];

  const normalizedType = /mix/gi.test(type) ? "Mixed" : type;

  const badgeColor =
    {
      Behavioral: "bg-slate-purple",
      Mixed: "bg-slate-purple",
      Technical: "bg-slate-purple",
      "System Design": "bg-slate-purple",
    }[normalizedType] || "bg-light-600";

  const formattedDate = dayjs(
    feedback?.createdAt || createdAt || Date.now()
  ).format("MMM D, YYYY");

  return (
    <div className="card-border w-[360px] max-sm:w-full h-[400px]">
      <div className="card-interview h-full flex flex-col justify-between">
        <div className="flex-1">
          {/* Type Badge */}
          <div
            className={cn(
              "absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg rounded-tr-lg  bg-slate-purple"
            )}
          >
            <p className="badge-text text-white">{normalizedType}</p>
          </div>

          {/* Taken Badge */}
          {isTaken && (
            <div className="absolute top-0 left-0 w-fit px-3 py-1 rounded-br-lg rounded-tl-lg bg-green-600">
              <p className="badge-text text-white text-xs">Taken</p>
            </div>
          )}

          {/* Cover Image */}
          <Image
            src={coverImage || "/covers/Amazon.svg"}
            alt="cover-image"
            width={60}
            height={60}
            className="object-contain size-[60px]"
          />

          {/* Interview Role */}
          <h3 className="mt-5 capitalize">{role} Interview</h3>

          {/* Date & Score */}
          <div className="flex flex-row gap-5 mt-3">
            <div className="flex flex-row gap-2">
              <Image
                src="/calendar.svg"
                width={22}
                height={22}
                alt="calendar"
              />
              <p>{formattedDate}</p>
            </div>

            <div className="flex flex-row gap-2 items-center">
              <Image src="/Rating.svg" width={22} height={22} alt="star" />
              <p>{feedback?.totalScore || "---"}/100</p>
            </div>
          </div>

          {/* Feedback or Placeholder Text */}
          <p className="line-clamp-2 mt-5">
            {feedback?.finalAssessment ||
              "You haven’t taken this interview yet"}
          </p>
        </div>

        <div className="flex flex-row justify-between">
          <DisplayTechIcons techStack={techstack} />

          <TakeInterviewButton
            isPremium={isPremium}
            feedbackCount={feedbackCount}
            interviewId={interviewId || ""}
            hasFeedback={!!feedback}
          />
        </div>
      </div>
    </div>
  );
};

export default InterviewCard;
