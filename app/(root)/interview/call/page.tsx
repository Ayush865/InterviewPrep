"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import Agent from "@/components/Agent";
import {
  GateLoading,
  GateAuthRequired,
  GateLimitReached,
} from "@/components/interview/GenerationGateStates";
import { useGenerationGate } from "@/hooks/useGenerationGate";

const Page = () => {
  const { user, isLoaded, loading, limitReached } = useGenerationGate();
  const [isLive, setIsLive] = useState(false);

  if (!isLoaded || loading) return <GateLoading />;
  if (!user?.id) return <GateAuthRequired />;
  if (limitReached) return <GateLimitReached />;

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 pt-12 max-sm:pt-8">
      {/* Page chrome dissolves once the call is live, giving the stage to the call */}
      <AnimatePresence initial={false}>
        {!isLive && (
          <motion.div
            key="call-chrome"
            initial={{ height: "auto", opacity: 1 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <Link
              href="/interview"
              className="inline-flex items-center gap-1.5 text-sm text-faint transition-colors duration-200 hover:text-strong"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Use the form instead
            </Link>

            <header className="mt-6 pb-10 text-center">
              <h1 className="display text-3xl">Talk to the hiring manager</h1>
              <p className="mx-auto mt-2 max-w-md text-soft">
                Describe the role, level, and tech stack on a quick call —
                we&apos;ll build your interview from the conversation.
              </p>
            </header>
          </motion.div>
        )}
      </AnimatePresence>

      <Agent
        userName={user.firstName || user.username || "User"}
        userId={user.id}
        userImage={user.imageUrl}
        type="generate"
        onLiveChange={setIsLive}
      />
    </div>
  );
};

export default Page;
