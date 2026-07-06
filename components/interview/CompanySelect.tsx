"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { interviewCompanies, companyToLogo } from "@/constants";

interface CompanySelectProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

const CompanySelect = ({ value, onChange }: CompanySelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = interviewCompanies.find((c) => c.value === value);

  const filtered = interviewCompanies.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSelect = (companyValue: string) => {
    onChange(companyValue);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="field-trigger flex cursor-pointer items-center justify-between gap-2"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected ? (
            <>
              <Image
                src={companyToLogo[selected.value]}
                alt=""
                width={18}
                height={18}
                className="shrink-0 object-contain"
              />
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-faint">No specific company</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              aria-label="Clear company"
              onClick={handleClear}
              className="rounded-full p-1 transition-colors duration-200 hover:bg-hover"
            >
              <X className="size-3.5 text-faint" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            className={`size-4 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-hairline bg-surface-overlay shadow-xl shadow-black/10 dark:shadow-black/40"
          >
            {/* Search */}
            <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company…"
                aria-label="Search company"
                className="flex-1 bg-transparent text-sm text-strong outline-none placeholder:text-faint"
              />
            </div>

            {/* Options */}
            <ul role="listbox" className="max-h-56 overflow-y-auto p-1.5">
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 hover:bg-hover",
                    !value ? "text-strong" : "text-soft"
                  )}
                >
                  No specific company
                  {!value && <Check className="size-4 text-accent" aria-hidden="true" />}
                </button>
              </li>

              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-faint">No results</li>
              ) : (
                filtered.map((company) => (
                  <li key={company.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === company.value}
                      onClick={() => handleSelect(company.value)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-strong transition-colors duration-150 hover:bg-hover"
                      )}
                    >
                      <Image
                        src={companyToLogo[company.value]}
                        alt=""
                        width={18}
                        height={18}
                        className="shrink-0 object-contain"
                      />
                      <span className="flex-1 text-left">{company.label}</span>
                      {value === company.value && (
                        <Check className="size-4 text-accent" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompanySelect;
