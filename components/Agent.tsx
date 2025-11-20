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
  userImage,
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
      console.log("✅ Call started successfully");
      setCallStatus(CallStatus.ACTIVE);
      setError(null); // Clear any errors when call starts successfully
    };

    const onCallEnd = () => {
      console.log("📞 Call ended");
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      console.log("📩 Message received:", message);
      
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        console.log("💬 Final transcript:", newMessage);
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    const onSpeechStart = () => {
      console.log("🗣️ Speech start");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("🤐 Speech end");
      setIsSpeaking(false);
    };

    const onError = (error: any) => {
      console.error("❌ VAPI Error (full object):", error);
      console.error("VAPI Error Details:", {
        message: error?.message,
        type: typeof error,
        constructor: error?.constructor?.name,
        keys: error ? Object.keys(error) : [],
        stringified: JSON.stringify(error, null, 2),
      });

      // If it's a Response object, log the details
      if (error instanceof Response) {
        console.error("VAPI Response Error:", {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
        });
      }
      
      // Check for specific error types
      if (error?.data || error?.error) {
        console.error("VAPI Error Data:", error.data || error.error);
      }

      // Check if this is an ejection error (call ended by server)
      if (error?.message?.includes("ejection") || error?.message?.includes("ended")) {
        console.error("⚠️ Call was ended by Vapi server (ejection)");
        console.error("This usually means:");
        console.error("1. Assistant configuration issue (check Vapi dashboard)");
        console.error("2. Max duration reached");
        console.error("3. Silence timeout triggered");
        console.error("4. Model/API error occurred");
        
        setError("The interview ended unexpectedly. This may be due to configuration limits or timeouts. Please check the console for details.");
      } else {
        // Set user-friendly error message
        const errorMessage = error instanceof Response 
          ? `API Error ${error.status}: ${error.statusText || 'Bad Request'}`
          : error?.message || "An error occurred during the call. Please try again.";
        
        setError(errorMessage);
      }
      
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
        const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
        
        if (!assistantId) {
          throw new Error("NEXT_PUBLIC_VAPI_ASSISTANT_ID is not defined");
        }

        if (!userName || !userId) {
          throw new Error("Missing user information (userName or userId)");
        }

        // Validate userId is not "NULL" string
        if (userId === "NULL" || userId === "null") {
          throw new Error("userId is set to NULL - user authentication failed");
        }

        console.log("Starting assistant with Web SDK:", {
          assistantId,
          userId,
          userName,
          vapiInstance: !!vapi,
        });

        // Start assistant and pass userId as a variable so the assistant
        // can use it in API calls without asking the user
        const call = await vapi.start(assistantId, {
          variableValues: {
            userid: userId, // This passes the actual Clerk user ID
          },
        });
        
        console.log("Call started successfully:", {
          callId: call?.id,
          callStatus: call?.status,
          variablesSet: { userid: userId },
          actualUserId: userId,
          userIdType: typeof userId,
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
              src={type==="generate"?"/ai-avatar.png":"/interviewer_female.png"}
              alt="profile-image"
              fill
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
              src={userImage || "/user-avatar.png"}
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
            {callStatus === "CONNECTING" ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="/call.svg"
                  alt="call"
                  width={20}
                  height={20}
                  className="object-contain"
                />
                <span>Start Call</span>
              </div>
            )}
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            <div className="flex items-center justify-center gap-2">
              <Image
                src="/call_end.svg"
                alt="end call"
                width={20}
                height={20}
                className="object-contain"
              />
              <span>End Call</span>
            </div>
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
