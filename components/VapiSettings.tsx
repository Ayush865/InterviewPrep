/**
 * components/VapiSettings.tsx
 *
 * UI component for users to link their Vapi API key and clone resources.
 */

"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { LinkPreview } from "./ui/link-preview";
import {
  saveUserVapiCredentials,
  getUserVapiCredentials,
  deleteUserVapiCredentials,
} from "@/lib/actions/vapi.action";
import {
  CheckCircle2,
  Settings,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Loader2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

interface CloneResult {
  assistantId: string;
  toolId: string;
  actions: string[];
}

interface ExistingCredentials {
  assistantId: string;
  toolId: string | null;
}

const maskId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

export function VapiSettings() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [webToken, setWebToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCredentials, setCheckingCredentials] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cloneResult, setCloneResult] = useState<CloneResult | null>(null);
  const [existingCredentials, setExistingCredentials] =
    useState<ExistingCredentials | null>(null);
  const [showReconfigure, setShowReconfigure] = useState(false);

  // Check for existing credentials on mount
  useEffect(() => {
    const checkExistingCredentials = async () => {
      if (!isLoaded || !user?.id) {
        setCheckingCredentials(false);
        return;
      }

      try {
        const credentials = await getUserVapiCredentials(user.id);
        if (credentials?.assistantId) {
          setExistingCredentials({
            assistantId: credentials.assistantId,
            toolId: credentials.toolId,
          });
        }
      } catch (err) {
        console.error("Error checking credentials:", err);
      } finally {
        setCheckingCredentials(false);
      }
    };

    checkExistingCredentials();
  }, [isLoaded, user]);

  const handleDeleteCredentials = async () => {
    if (!user?.id) return;

    if (
      !confirm(
        "Are you sure you want to delete your VAPI credentials? You will need to reconfigure them to use voice calls."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await deleteUserVapiCredentials(user.id);
      if (result.success) {
        localStorage.removeItem("vapi_assistant_id");
        localStorage.removeItem("vapi_tool_id");
        localStorage.removeItem("vapi_web_token");
        localStorage.removeItem("vapi_user_id");

        setExistingCredentials(null);
        setSuccess("Credentials deleted successfully");
      } else {
        setError(result.error || "Failed to delete credentials");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkAndClone = async () => {
    if (!user) {
      setError("Please sign in first");
      return;
    }

    if (!apiKey.trim()) {
      setError("Please enter your Vapi Private API key");
      return;
    }

    if (!webToken.trim()) {
      setError("Please enter your Vapi Public Web Token");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Link the API key
      const linkResponse = await fetch("/api/vapi/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          apiKey: apiKey.trim(),
        }),
      });

      if (!linkResponse.ok) {
        const linkError = await linkResponse.json();
        throw new Error(linkError.error || "Failed to link API key");
      }

      // Step 2: Clone assistant and tool
      const cloneResponse = await fetch("/api/vapi/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (!cloneResponse.ok) {
        const cloneError = await cloneResponse.json();
        throw new Error(cloneError.error || "Failed to clone resources");
      }

      const cloneData: CloneResult = await cloneResponse.json();

      // Step 3: Save credentials
      const dbResult = await saveUserVapiCredentials(user.id, {
        webToken: webToken.trim(),
        assistantId: cloneData.assistantId,
        toolId: cloneData.toolId,
      });

      if (!dbResult.success) {
        throw new Error(
          dbResult.error || "Failed to save credentials to database"
        );
      }

      // Save to localStorage for quick access (fallback)
      localStorage.setItem("vapi_assistant_id", cloneData.assistantId);
      localStorage.setItem("vapi_tool_id", cloneData.toolId);
      localStorage.setItem("vapi_web_token", webToken.trim());
      localStorage.setItem("vapi_user_id", user.id);

      setCloneResult(cloneData);
      setSuccess("Your personal assistant is ready to use.");
      setApiKey(""); // Clear the inputs for security
      setWebToken("");

      setExistingCredentials({
        assistantId: cloneData.assistantId,
        toolId: cloneData.toolId,
      });
      setShowReconfigure(false);
    } catch (err: any) {
      console.error("Error linking Vapi:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const feedbackBanners = (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="alert"
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3"
        >
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Loading state
  if (checkingCredentials) {
    return (
      <div
        className="panel flex items-center justify-center px-8 py-16"
        role="status"
        aria-label="Checking your configuration"
      >
        <div className="flex items-center gap-3 text-soft">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Checking your configuration…</span>
        </div>
      </div>
    );
  }

  // Connected state
  if (existingCredentials && !showReconfigure) {
    return (
      <div className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="panel p-7"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
              <ShieldCheck
                className="size-5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-strong">
                Vapi connected
              </h2>
              <p className="text-sm text-soft">
                Your API key is linked and ready to use.
              </p>
            </div>
          </div>

          {/* Credential rows */}
          <dl className="mt-6 flex flex-col gap-2 rounded-xl border border-hairline bg-raise p-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-faint">Assistant ID</dt>
              <dd>
                <code className="rounded-md border border-hairline bg-raise px-2.5 py-1 font-mono text-xs text-body">
                  {maskId(existingCredentials.assistantId)}
                </code>
              </dd>
            </div>
            {existingCredentials.toolId && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-faint">Tool ID</dt>
                <dd>
                  <code className="rounded-md border border-hairline bg-raise px-2.5 py-1 font-mono text-xs text-body">
                    {maskId(existingCredentials.toolId)}
                  </code>
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.push("/interview")}
              className="btn-accent flex-1"
            >
              Generate interview
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setShowReconfigure(true)}
              className="btn-quiet"
            >
              <Settings className="size-4" aria-hidden="true" />
              Reconfigure
            </button>
          </div>

          <div className="mt-4">{feedbackBanners}</div>
        </motion.div>

        {/* What you get */}
        <div className="panel p-7">
          <h3 className="text-sm font-semibold tracking-tight text-strong">
            What you can do
          </h3>
          <ul className="mt-4 flex list-none flex-col gap-2.5">
            {[
              "Generate unlimited interviews via voice call",
              "Use your personalized AI interview assistant",
              "All costs are billed to your Vapi account",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-body">
                <CheckCircle2
                  className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Link / reconfigure form
  return (
    <div className="flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="panel p-7"
      >
        {showReconfigure && (
          <button
            onClick={() => setShowReconfigure(false)}
            className="mb-5 inline-flex cursor-pointer items-center gap-1.5 text-sm text-faint transition-colors duration-200 hover:text-strong"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to overview
          </button>
        )}

        <div className="flex items-center gap-4">
          <div className="icon-tile size-12 shrink-0">
            <KeyRound className="size-5 text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-strong">
              {showReconfigure ? "Reconfigure Vapi" : "Connect your Vapi account"}
            </h2>
            <p className="text-sm text-soft">
              {showReconfigure
                ? "Update your Vapi credentials with new API keys."
                : "Link your personal API key to get your own interview assistant."}
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-5">
          {/* Private API Key */}
          <div>
            <label
              htmlFor="apiKey"
              className="mb-2 block text-sm font-medium text-body"
            >
              Private API key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="vapi_sk_…"
              className="field-trigger placeholder:text-faint"
              disabled={loading}
            />
            <p className="mt-1.5 text-xs text-faint">
              Used once to clone the assistant and tool into your account.
            </p>
          </div>

          {/* Public Web Token */}
          <div>
            <label
              htmlFor="webToken"
              className="mb-2 block text-sm font-medium text-body"
            >
              Public web token
            </label>
            <input
              id="webToken"
              type="password"
              value={webToken}
              onChange={(e) => setWebToken(e.target.value)}
              placeholder="vapi_pk_…"
              className="field-trigger placeholder:text-faint"
              disabled={loading}
            />
            <div className="mt-1.5 text-xs text-faint">
              Used for voice calls. Get both keys from the{" "}
              <LinkPreview
                url="https://dashboard.vapi.ai/org/api-keys"
                className="font-medium text-accent hover:underline"
                isStatic={true}
                imageSrc="/vapi_dashboard.png"
              >
                Vapi dashboard
              </LinkPreview>
              .
            </div>
          </div>

          <button
            onClick={handleLinkAndClone}
            disabled={loading || !apiKey.trim() || !webToken.trim()}
            className="btn-accent !h-12 w-full"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Linking and cloning…
              </>
            ) : showReconfigure ? (
              "Update & clone new assistant"
            ) : (
              "Link key & clone assistant"
            )}
          </button>

          {showReconfigure && existingCredentials && (
            <button
              onClick={handleDeleteCredentials}
              disabled={loading}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete credentials
            </button>
          )}

          {feedbackBanners}

          {/* Clone details */}
          {cloneResult && (
            <div className="rounded-xl border border-hairline bg-raise p-4">
              <h3 className="text-sm font-semibold text-strong">Clone details</h3>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-faint">Assistant ID</dt>
                  <dd>
                    <code className="font-mono text-xs text-body">
                      {maskId(cloneResult.assistantId)}
                    </code>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-faint">Tool ID</dt>
                  <dd>
                    <code className="font-mono text-xs text-body">
                      {maskId(cloneResult.toolId)}
                    </code>
                  </dd>
                </div>
              </dl>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-faint transition-colors duration-200 hover:text-strong">
                  View actions ({cloneResult.actions.length})
                </summary>
                <ul className="mt-2 flex list-none flex-col gap-1 pl-1 text-xs text-soft">
                  {cloneResult.actions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>
      </motion.div>

      {/* How it works */}
      <div className="panel p-7">
        <h3 className="text-sm font-semibold tracking-tight text-strong">
          How it works
        </h3>
        <ol className="mt-4 flex list-none flex-col gap-3">
          {[
            "Get both keys from your Vapi dashboard's API Keys section.",
            "Enter your private key (server operations) and public web token (voice calls).",
            "We validate the keys and clone the interview assistant into your account.",
            "Your personal assistant handles all future interview calls — billing stays on your Vapi account.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-body">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-raise text-xs font-semibold text-soft">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
