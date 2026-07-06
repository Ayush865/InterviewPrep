"use client";

import { useState, ReactNode } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

import Agent from "@/components/Agent";

interface InterviewSessionProps {
  interviewId: string;
  role: string;
  type: string;
  level: string;
  coverImage: string | null;
  questionCount: number;
  questions: string[];
  feedbackId?: string;
  userName: string;
  userId: string;
  userImage?: string;
  /** Server-rendered tech icons, passed through as a slot */
  techIcons?: ReactNode;
}

const InterviewSession = ({
  interviewId,
  role,
  type,
  level,
  coverImage,
  questionCount,
  questions,
  feedbackId,
  userName,
  userId,
  userImage,
  techIcons,
}: InterviewSessionProps) => {
  const [isLive, setIsLive] = useState(false);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl pb-24 transition-[padding] duration-500",
        isLive ? "pt-4" : "pt-12 max-sm:pt-8"
      )}
    >
      {/* Header shrinks to a slim bar while the call is live,
          freeing vertical space for the participant tiles */}
      <motion.header
        layout
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={cn(
          "panel flex items-center justify-between gap-4",
          isLive ? "px-4 py-2.5" : "p-5 max-sm:flex-col max-sm:items-start"
        )}
      >
        <motion.div layout className="flex min-w-0 items-center gap-4">
          <motion.div
            layout
            className={cn(
              "icon-tile shrink-0",
              isLive ? "size-8 rounded-lg p-1" : "size-12 p-2"
            )}
          >
            <Image
              src={coverImage || "/covers/Amazon.svg"}
              alt=""
              width={40}
              height={40}
              className={cn("object-contain", isLive ? "size-5" : "size-8")}
            />
          </motion.div>
          <motion.div layout className="min-w-0">
            <h1
              className={cn(
                "truncate font-semibold capitalize tracking-tight text-strong transition-[font-size] duration-300",
                isLive ? "text-sm" : "text-lg"
              )}
            >
              {role} Interview
            </h1>
            <AnimatePresence initial={false}>
              {!isLive && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden text-sm capitalize text-faint"
                >
                  {level} · {questionCount}{" "}
                  {questionCount === 1 ? "question" : "questions"}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <AnimatePresence initial={false}>
          {!isLive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex shrink-0 items-center gap-3"
            >
              {techIcons}
              <span className="inline-flex items-center rounded-full border border-hairline bg-raise px-3 py-1 text-xs font-medium capitalize text-body">
                {type}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={isLive ? "mt-4" : "mt-8"}
      >
        <Agent
          userName={userName}
          userId={userId}
          userImage={userImage}
          interviewId={interviewId}
          type="interview"
          questions={questions}
          feedbackId={feedbackId}
          onLiveChange={setIsLive}
        />
      </motion.div>
    </div>
  );
};

export default InterviewSession;
