import { cn } from "@/lib/utils";

interface SessionReplayProps {
  transcript: { role: string; content: string }[];
  interviewerName?: string;
  userName: string;
}

/**
 * Full session transcript replay — the user's actual answers next to the
 * interviewer's questions.
 */
const SessionReplay = ({
  transcript,
  interviewerName = "Interviewer",
  userName,
}: SessionReplayProps) => {
  if (!transcript || transcript.length === 0) return null;

  // Merge consecutive turns from the same speaker for readability
  const turns: { role: string; content: string }[] = [];
  for (const message of transcript) {
    const last = turns[turns.length - 1];
    if (last && last.role === message.role) {
      last.content += ` ${message.content}`;
    } else {
      turns.push({ ...message });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {turns.map((turn, index) => {
        const isUser = turn.role === "user";
        return (
          <div
            key={index}
            className={cn("flex", isUser ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3",
                isUser
                  ? "rounded-br-md border border-accent/20 bg-accent/10"
                  : "rounded-bl-md border border-hairline bg-raise"
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-faint">
                {isUser ? userName : interviewerName}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-body">
                {turn.content}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SessionReplay;
