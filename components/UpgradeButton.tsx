"use client";

import { useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeButtonProps {
  /** "checkout" starts a new subscription, "manage" handles an existing one */
  mode?: "checkout" | "manage" | "portal";
  /** Ask before proceeding (e.g. Razorpay cancellation) */
  confirmMessage?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Provider-agnostic billing action. Redirects when the API returns a
 * URL (Stripe Checkout/portal, Razorpay hosted page); shows the result
 * and refreshes when it returns a message (Razorpay cancellation).
 */
const UpgradeButton = ({
  mode = "checkout",
  confirmMessage,
  className,
  children,
}: UpgradeButtonProps) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const endpoint =
    mode === "checkout" ? "/api/billing/checkout" : "/api/billing/manage";

  const handleClick = async () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.message) {
        toast.success(data.message);
        router.refresh();
      }
      setLoading(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to open billing"
      );
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn("btn-accent", className)}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        mode === "checkout" && (
          <Sparkles className="size-4" aria-hidden="true" />
        )
      )}
      {children ?? (mode === "checkout" ? "Upgrade to Pro" : "Manage subscription")}
    </button>
  );
};

export default UpgradeButton;
