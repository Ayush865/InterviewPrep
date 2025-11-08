"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

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

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setError(null); // Clear any errors when call starts successfully
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      console.log("speech start");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("speech end");
      setIsSpeaking(false);
    };

    const onError = (error: any) => {
      console.error("VAPI Error:", {
        error,
        errorMessage: error?.message || "No error message",
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorString: String(error),
      });

      // If it's a Response object, log the details
      if (error instanceof Response) {
        console.error("VAPI Response Error Details:", {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          // Don't try to read the body as it's already consumed by VAPI SDK
        });
      }
      
      // Check if error has a data property (VAPI error format)
      if (error?.data || error?.error) {
        console.error("VAPI Error Data:", error.data || error.error);
      }
      
      // Set user-friendly error message
      const errorMessage = error instanceof Response 
        ? `API Error ${error.status}: ${error.statusText || 'Bad Request'}. Please check the console for details.`
        : error?.message || "An error occurred during the call. Please try again.";
      
      setError(errorMessage);
      
      // Reset call status on error
      setCallStatus(CallStatus.INACTIVE);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      console.log("handleGenerateFeedback");

      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messages,
        feedbackId,
      });

      if (success && id) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        console.log("Error saving feedback");
        router.push("/");
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else {
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    setError(null); // Clear any previous errors

    try {
      // Validate VAPI instance
      if (!vapi) {
        throw new Error("VAPI instance is not initialized");
      }

      if (type === "generate") {
        // IMPORTANT: The web SDK cannot start workflows directly.
        // Workflows require the server SDK or an assistant that references the workflow.
        
        // Temporary workaround: Use an assistant that mimics the workflow behavior
        console.warn("⚠️ Web SDK cannot start workflows directly. Using assistant fallback.");
        
        const workflowAssistant = {
          name: "Interview Generator",
          model: {
            provider: "openai",
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are a voice assistant helping with creating new AI interviewers. Your task is to collect data from the user.
                
Ask the user for:
1. Job experience level (Junior, Mid, Senior)
2. Number of questions to generate
3. Technologies to cover (e.g., React, Node.js, Python)
4. Job role (e.g., Frontend, Backend, Full Stack)
5. Interview type (Technical, Behavioral, or Mixed)

After collecting all information, confirm with the user and let them know you'll generate their interview.

Remember this is a voice conversation - do not use any special characters.

User ID: ${userId}
Username: ${userName}`,
              },
            ],
          },
          voice: {
            voiceId: "Elliot",
            provider: "vapi",
          },
          firstMessage: "Hi! I'll help you create a custom AI interviewer. Let me ask you a few questions to personalize your interview.",
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
          },
          // Note: Tool calling would go here to trigger /api/vapi/generate
          // For now, this is a placeholder until you set up proper workflow support
        };

        console.log("Starting workflow-like assistant with user context:", {
          userId,
          userName,
        });

        await vapi.start(workflowAssistant as any, {
          variableValues: {
            userid: userId,
            username: userName,
          },
        });
      } else {
        let formattedQuestions = "";
        if (questions) {
          formattedQuestions = questions
            .map((question) => `- ${question}`)
            .join("\n");
        }

        console.log("Starting VAPI interviewer with:", {
          questionsCount: questions?.length || 0,
        });

        await vapi.start(interviewer, {
          variableValues: {
            questions: formattedQuestions,
          },
        });
      }
    } catch (error: any) {
      console.error("Error starting call:", {
        raw: error,
        type: typeof error,
        name: error?.name,
        message: error?.message,
        keys: error ? Object.keys(error) : [],
        toString: String(error),
      });

      setError(
        error?.message ||
          "Failed to start the interview. Please verify your Vapi Web Token and Workflow Id belong to the same project and try again."
      );
      setCallStatus(CallStatus.INACTIVE);
    }
  };

  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        {/* User Profile Card */}
        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full flex justify-center mb-4">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded max-w-md text-center">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-700 hover:text-red-900 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={() => handleCall()}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
