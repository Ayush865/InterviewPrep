"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronDown, Search, X } from "lucide-react";
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-dark-200 border border-dark-200 text-sm hover:border-primary-200/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <Image
                src={companyToLogo[selected.value]}
                alt={selected.label}
                width={18}
                height={18}
                className="object-contain shrink-0"
              />
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-light-400">No specific company</span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-dark-300"
            >
              <X className="h-3.5 w-3.5 text-light-400" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-light-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-dark-200 border border-dark-300 shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-300">
            <Search className="h-3.5 w-3.5 text-light-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-light-400"
            />
          </div>

          {/* Options */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {/* No company option */}
            <li>
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false); setSearch(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-dark-300 transition-colors ${!value ? "text-primary-200" : "text-light-400"}`}
              >
                No specific company
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-light-400">No results</li>
            ) : (
              filtered.map((company) => (
                <li key={company.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(company.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-dark-300 transition-colors ${value === company.value ? "text-primary-200" : "text-white"}`}
                  >
                    <Image
                      src={companyToLogo[company.value]}
                      alt={company.label}
                      width={18}
                      height={18}
                      className="object-contain shrink-0"
                    />
                    {company.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CompanySelect;
