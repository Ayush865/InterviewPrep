"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import UpgradeButton from "@/components/UpgradeButton";
import {
  PLAN_PRICES,
  TRIAL_DAYS,
  type Plan,
  type BillingInterval,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

interface PricingTiersProps {
  currentPlan: Plan;
  /** Display currency based on the configured payment provider */
  currency: "inr" | "usd";
  /** First-time subscribers get the trial */
  trialEligible: boolean;
}

const tierFeatures = {
  free: [
    "Unlimited form interview generations",
    "1 hiring-manager call generation",
    "1 practice session",
    "Score & basic feedback",
  ],
  pro: [
    "10 generations + 10 sessions / month",
    "Progress dashboard & score history",
    "Session replay with transcripts",
    "Targeted drills on weak areas",
    "Job-description interviews",
    "1 AI resume review / month",
  ],
  elite: [
    "Everything in Pro",
    "30 generations + 30 sessions / month",
    "Unlimited AI resume reviews",
    "Priority support",
  ],
};

function formatPrice(amount: number, currency: "inr" | "usd") {
  return currency === "inr" ? `₹${amount.toLocaleString("en-IN")}` : `$${amount}`;
}

const PricingTiers = ({ currentPlan, currency, trialEligible }: PricingTiersProps) => {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const priceFor = (plan: "pro" | "elite") =>
    PLAN_PRICES[plan][interval][currency];

  const monthlyEquivalent = (plan: "pro" | "elite") =>
    interval === "annual"
      ? Math.round(PLAN_PRICES[plan].annual[currency] / 12)
      : PLAN_PRICES[plan].monthly[currency];

  const savingsPct = (plan: "pro" | "elite") =>
    Math.round(
      (1 -
        PLAN_PRICES[plan].annual[currency] /
          (PLAN_PRICES[plan].monthly[currency] * 12)) *
        100
    );

  return (
    <div>
      {/* Interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-hairline bg-raise p-1">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              className={cn(
                "relative cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                interval === option
                  ? "text-strong"
                  : "text-faint hover:text-strong"
              )}
              aria-pressed={interval === option}
            >
              {interval === option && (
                <motion.span
                  layoutId="interval-pill"
                  className="absolute inset-0 rounded-full border border-hairline bg-surface-overlay shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative capitalize">
                {option}
                {option === "annual" && (
                  <span className="ml-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    −{savingsPct("pro")}%
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Free */}
        <div className="panel flex flex-col p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-faint">
            Free
          </h3>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-strong">
            {formatPrice(0, currency)}
          </p>
          <p className="mt-1 text-xs text-faint">forever</p>
          <ul className="mt-5 flex flex-1 list-none flex-col gap-2.5">
            {tierFeatures.free.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-body">
                <Check className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {currentPlan === "free" ? (
              <span className="inline-flex h-10 w-full items-center justify-center rounded-full border border-hairline text-sm font-medium text-faint">
                Current plan
              </span>
            ) : (
              <span className="inline-flex h-10 w-full items-center justify-center text-sm text-faint">
                &nbsp;
              </span>
            )}
          </div>
        </div>

        {/* Pro — recommended */}
        <div className="panel relative flex flex-col border-accent/40 p-6">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
            Recommended
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-accent">
            Pro
          </h3>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-strong">
            {formatPrice(monthlyEquivalent("pro"), currency)}
            <span className="text-sm font-normal text-faint">/mo</span>
          </p>
          <p className="mt-1 text-xs text-faint">
            {interval === "annual"
              ? `billed ${formatPrice(priceFor("pro"), currency)}/year`
              : "billed monthly"}
            {trialEligible && ` · ${TRIAL_DAYS}-day free trial`}
          </p>
          <ul className="mt-5 flex flex-1 list-none flex-col gap-2.5">
            {tierFeatures.pro.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-body">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {currentPlan === "pro" ? (
              <span className="inline-flex h-10 w-full items-center justify-center rounded-full border border-hairline text-sm font-medium text-faint">
                Current plan
              </span>
            ) : (
              <UpgradeButton
                plan="pro"
                interval={interval}
                className="!h-10 w-full text-sm"
              >
                {trialEligible ? "Start free trial" : "Upgrade to Pro"}
              </UpgradeButton>
            )}
          </div>
        </div>

        {/* Elite */}
        <div className="panel flex flex-col p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-faint">
            Elite
          </h3>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-strong">
            {formatPrice(monthlyEquivalent("elite"), currency)}
            <span className="text-sm font-normal text-faint">/mo</span>
          </p>
          <p className="mt-1 text-xs text-faint">
            {interval === "annual"
              ? `billed ${formatPrice(priceFor("elite"), currency)}/year`
              : "billed monthly"}
          </p>
          <ul className="mt-5 flex flex-1 list-none flex-col gap-2.5">
            {tierFeatures.elite.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-body">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {currentPlan === "elite" ? (
              <span className="inline-flex h-10 w-full items-center justify-center rounded-full border border-hairline text-sm font-medium text-faint">
                Current plan
              </span>
            ) : (
              <UpgradeButton
                plan="elite"
                interval={interval}
                className="!h-10 w-full text-sm !bg-transparent !text-strong border border-hairline-strong hover:!bg-hover"
              >
                Upgrade to Elite
              </UpgradeButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingTiers;
