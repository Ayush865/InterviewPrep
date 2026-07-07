"use client";

import { useState, ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeButtonProps {
  /** "checkout" starts a new subscription, "portal" manages an existing one */
  mode?: "checkout" | "portal";
  className?: string;
  children?: ReactNode;
}

/**
 * Redirects to Stripe Checkout (subscribe) or the Billing Portal (manage).
 */
const UpgradeButton = ({
  mode = "checkout",
  className,
  children,
}: UpgradeButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stripe/${mode}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      window.location.href = data.url;
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
      {children ?? (mode === "checkout" ? "Upgrade to Pro — $5/mo" : "Manage subscription")}
    </button>
  );
};

export default UpgradeButton;
