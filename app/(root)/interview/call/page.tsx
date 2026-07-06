"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Agent from "@/components/Agent";
import {
  GateLoading,
  GateAuthRequired,
  GateLimitReached,
} from "@/components/interview/GenerationGateStates";
import { useGenerationGate } from "@/hooks/useGenerationGate";

const Page = () => {
  const { user, isLoaded, loading, limitReached } = useGenerationGate();

  if (!isLoaded || loading) return <GateLoading />;
  if (!user?.id) return <GateAuthRequired />;
  if (limitReached) return <GateLimitReached />;

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 pt-12 max-sm:pt-8">
      <Link
        href="/interview"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors duration-200 hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Use the form instead
      </Link>

      <header className="mt-6 text-center">
        <h1 className="display text-3xl">Talk to the hiring manager</h1>
        <p className="mx-auto mt-2 max-w-md text-zinc-400">
          Describe the role, level, and tech stack on a quick call — we&apos;ll
          build your interview from the conversation.
        </p>
      </header>

      <div className="mt-10">
        <Agent
          userName={user.firstName || user.username || "User"}
          userId={user.id}
          userImage={user.imageUrl}
          type="generate"
        />
      </div>
    </div>
  );
};

export default Page;
