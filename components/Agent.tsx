"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { SESSION_MAX_DURATION_SECONDS } from "@/lib/plans";
import {
  createFeedback,
  getLatestGeneratedInterview,
} from "@/lib/actions/general.action";
import { useVapiAssistant } from "@/hooks/useVapiAssistant";
import InterviewSuccessModal from "./interview/InterviewSuccessModal";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const statusLabel: Record<CallStatus, string> = {
  [CallStatus.INACTIVE]: "Ready to start",
  [CallStatus.CONNECTING]: "Connecting…",
  [CallStatus.ACTIVE]: "Live",
  [CallStatus.FINISHED]: "Call ended",
};

const Agent = ({
  userName,
  userId,
  userImage,
  interviewId,
  feedbackId,
  type,
  questions,
  onLiveChange,
}: AgentProps) => {
  const router = useRouter();

  // Use custom assistant if user has linked their API key
  const {
    assistantId: customAssistantId,
    apiKey: customApiKey,
    isCustom,
    isLoading: assistantLoading,
  } = useVapiAssistant();

  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<SavedMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [vapiInstance, setVapiInstance] = useState<Vapi | null>(null);
  const [generatedInterviewId, setGeneratedInterviewId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const feedbackGeneratedRef = useRef(false);
  const messagesRef = useRef<SavedMessage[]>([]);

  // Let the host page react to the call going live (e.g. dissolve its header)
  useEffect(() => {
    onLiveChange?.(callStatus === CallStatus.ACTIVE);
  }, [callStatus, onLiveChange]);

  // Initialize Vapi instance — user's own API key if linked, default otherwise
  useEffect(() => {
    if (assistantLoading) return;

    const instance = isCustom && customApiKey ? new Vapi(customApiKey) : vapi;
    setVapiInstance(instance);

    return () => {
      // Cleanup: only stop custom instances we created here
      if (isCustom && customApiKey && instance) {
        instance.stop();
      }
    };
  }, [isCustom, customApiKey, assistantLoading]);

  useEffect(() => {
    if (!vapiInstance) return;

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setError(null);
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => {
          const updated = [...prev, newMessage];
          messagesRef.current = updated;
          return updated;
        });
      }

      // Capture function call result containing interviewId from generate endpoint
      if (message.type === "function-call-result") {
        try {
          const result = (message as any).functionCallResult;
          if (result) {
            const parsed = typeof result === "string" ? JSON.parse(result) : result;
            if (parsed.success && parsed.interviewId) {
              setGeneratedInterviewId(parsed.interviewId);
            }
          }
        } catch {
          // Non-JSON function result — ignore
        }
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);

    const onError = (error: any) => {
      console.error("VAPI error:", error);

      if (
        error?.message?.includes("ejection") ||
        error?.message?.includes("ended")
      ) {
        setError(
          "The call ended unexpectedly. This is usually a configuration limit or timeout — please try again."
        );
      } else {
        const errorMessage =
          error instanceof Response
            ? `API error ${error.status}: ${error.statusText || "Bad Request"}`
            : error?.message ||
              "An error occurred during the call. Please try again.";
        setError(errorMessage);
      }

      setCallStatus(CallStatus.INACTIVE);
    };

    vapiInstance.on("call-start", onCallStart);
    vapiInstance.on("call-end", onCallEnd);
    vapiInstance.on("message", onMessage);
    vapiInstance.on("speech-start", onSpeechStart);
    vapiInstance.on("speech-end", onSpeechEnd);
    vapiInstance.on("error", onError);

    return () => {
      vapiInstance.off("call-start", onCallStart);
      vapiInstance.off("call-end", onCallEnd);
      vapiInstance.off("message", onMessage);
      vapiInstance.off("speech-start", onSpeechStart);
      vapiInstance.off("speech-end", onSpeechEnd);
      vapiInstance.off("error", onError);
    };
  }, [vapiInstance]);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1]);
    }

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      const userMessages = messages.filter((m) => m.role === "user");
      const userChars = userMessages.reduce(
        (sum, m) => sum + m.content.trim().length,
        0
      );

      console.info("[Agent] Call finished, evaluating transcript", {
        interviewId,
        totalMessages: messages.length,
        userMessages: userMessages.length,
        userChars,
      });

      // Don't request a score for an interview the candidate never answered —
      // the server also rejects this, but catching it here gives instant UX.
      if (userMessages.length === 0 || userChars < 20) {
        console.warn("[Agent] Feedback skipped: no candidate answers detected");
        feedbackGeneratedRef.current = false; // allow another attempt
        setError(
          "We didn't hear any answers from you, so no feedback was generated. Start the call again and answer out loud."
        );
        return;
      }

      setIsGeneratingFeedback(true);

      const result = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messages,
        feedbackId,
      });

      if (result.success && result.feedbackId) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        console.error("[Agent] Feedback generation failed", result);
        setIsGeneratingFeedback(false);
        feedbackGeneratedRef.current = false; // allow another attempt
        setError(
          "reason" in result && result.reason === "no_user_responses"
            ? "We didn't hear any answers from you, so no feedback was generated. Start the call again and answer out loud."
            : "We couldn't generate your feedback. Please try the interview again."
        );
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        // If we already have the interviewId from VAPI message, show modal
        if (generatedInterviewId) {
          setShowSuccessModal(true);
        } else {
          // Fallback: fetch the most recently created interview for this user
          const fetchLatestInterview = async () => {
            const result = await getLatestGeneratedInterview(userId!);
            if (result.success && result.interviewId) {
              setGeneratedInterviewId(result.interviewId);
              setShowSuccessModal(true);
            } else {
              router.push("/");
            }
          };
          fetchLatestInterview();
        }
      } else if (!feedbackGeneratedRef.current && messages.length > 0) {
        feedbackGeneratedRef.current = true;
        // Wait 1s for any trailing VAPI transcripts to arrive after call-end
        setTimeout(() => handleGenerateFeedback(messagesRef.current), 1000);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId, generatedInterviewId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    setError(null);

    // Fresh transcript per attempt — a retry after a silent call must not
    // inherit the previous call's messages
    setMessages([]);
    messagesRef.current = [];
    setLastMessage(null);

    try {
      if (!vapiInstance) {
        throw new Error("Voice service is not ready yet. Please try again.");
      }

      if (type === "generate") {
        const assistantId =
          customAssistantId || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

        if (!assistantId) {
          throw new Error(
            "No assistant configured. Please set up Vapi in settings."
          );
        }

        if (!userName || !userId || userId === "NULL" || userId === "null") {
          throw new Error("User authentication failed. Please sign in again.");
        }

        // Pass userId so the assistant can attribute the generated interview
        await vapiInstance.start(assistantId, {
          variableValues: { userid: userId },
        });
      } else {
        const formattedQuestions = (questions ?? [])
          .map((question) => `- ${question}`)
          .join("\n");

        // Free/Pro sessions run on our Vapi account and are capped at
        // 30 minutes; BYOK users are on their own bill and uncapped
        const assistantConfig = isCustom
          ? interviewer
          : { ...interviewer, maxDurationSeconds: SESSION_MAX_DURATION_SECONDS };

        await vapiInstance.start(assistantConfig, {
          variableValues: { questions: formattedQuestions },
        });
      }
    } catch (error: any) {
      console.error("Error starting call:", error);
      setError(
        error?.message ||
          "Failed to start the interview. Please verify your Vapi credentials and try again."
      );
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapiInstance?.stop();
  };

  const interviewerName = type === "generate" ? "Hiring Manager" : "AI Interviewer";
  const isLive = callStatus === CallStatus.ACTIVE;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Status pill */}
      <div className="flex justify-center">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium",
            isLive
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-hairline bg-raise text-soft"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              isLive ? "animate-pulse bg-emerald-500 dark:bg-emerald-400" : "bg-faint"
            )}
            aria-hidden="true"
          />
          {statusLabel[callStatus]}
        </span>
      </div>

      {/* Participants — tiles expand smoothly once the call goes live */}
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {/* AI interviewer */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className={cn(
            "panel flex flex-col items-center justify-center gap-4 px-6",
            isLive ? "py-20 max-sm:py-14" : "py-12"
          )}
        >
          <div className="relative">
            <div
              className={cn(
                "absolute -inset-2 rounded-full border-2 border-accent/60 transition-opacity duration-300",
                isSpeaking ? "animate-pulse opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />
            <motion.div
              layout
              className={cn(
                "relative overflow-hidden rounded-full border border-hairline-strong",
                isLive ? "size-32" : "size-24"
              )}
            >
              <Image
                src={
                  type === "generate"
                    ? "/ai-avatar.png"
                    : "/interviewer-avatar-female.png"
                }
                alt={interviewerName}
                fill
                className="object-cover"
              />
            </motion.div>
          </div>
          <motion.div layout className="text-center">
            <p className="font-medium text-strong">{interviewerName}</p>
            <p className="mt-0.5 text-sm text-faint">
              {isSpeaking ? "Speaking…" : "Hired Fox AI"}
            </p>
          </motion.div>
        </motion.div>

        {/* User */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className={cn(
            "panel flex flex-col items-center justify-center gap-4 px-6",
            isLive ? "py-20 max-sm:py-14" : "py-12"
          )}
        >
          <motion.div
            layout
            className={cn(
              "relative overflow-hidden rounded-full border border-hairline-strong",
              isLive ? "size-32" : "size-24"
            )}
          >
            <Image
              src={userImage || "/user-avatar.png"}
              alt={userName || "You"}
              fill
              className="object-cover"
            />
          </motion.div>
          <motion.div layout className="text-center">
            <p className="font-medium text-strong">{userName}</p>
            <p className="mt-0.5 text-sm text-faint">You</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Live transcript */}
      <AnimatePresence>
        {lastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
            className="panel px-6 py-5"
            aria-live="polite"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-faint">
              {lastMessage.role === "assistant" ? interviewerName : userName}
            </p>
            <p
              key={lastMessage.content}
              className="animate-fadeIn mt-2 text-[15px] leading-relaxed text-body"
            >
              {lastMessage.content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="alert"
            className="flex items-start justify-between gap-4 rounded-xl border border-red-500/25 bg-red-500/10 px-5 py-4"
          >
            <p className="text-sm leading-relaxed text-red-700 dark:text-red-300">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="shrink-0 rounded-full p-1 text-red-700 dark:text-red-300 transition-colors duration-200 hover:bg-red-500/20 hover:text-strong"
              aria-label="Dismiss error"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call controls */}
      <div className="flex flex-col items-center gap-3">
        {isGeneratingFeedback ? (
          <div className="flex items-center gap-2 text-soft">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">Analyzing your interview…</span>
          </div>
        ) : !isLive ? (
          <button
            className="btn-accent h-12 min-w-44"
            onClick={handleCall}
            disabled={callStatus === CallStatus.CONNECTING}
          >
            {callStatus === CallStatus.CONNECTING ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Connecting…
              </>
            ) : (
              <>
                <Phone className="size-4" aria-hidden="true" />
                Start call
              </>
            )}
          </button>
        ) : (
          <button
            className="inline-flex h-12 min-w-44 cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            onClick={handleDisconnect}
          >
            <PhoneOff className="size-4" aria-hidden="true" />
            End call
          </button>
        )}

        {callStatus === CallStatus.INACTIVE && !error && (
          <p className="text-sm text-faint">
            Make sure your microphone is enabled.
          </p>
        )}
      </div>

      {/* Success modal for VAPI-generated interviews */}
      <InterviewSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          if (generatedInterviewId) {
            router.push(`/interview/${generatedInterviewId}`);
          }
        }}
      />
    </div>
  );
};

export default Agent;
