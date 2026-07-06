"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { techstackOptions } from "@/constants";

interface TechstackMultiSelectProps {
  selected: string[];
  onChange: (value: string[]) => void;
}

const TechstackMultiSelect = ({
  selected,
  onChange,
}: TechstackMultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="field-trigger flex cursor-pointer items-center justify-between gap-2"
          >
            <span className={selected.length > 0 ? "text-strong" : "text-faint"}>
              {selected.length > 0
                ? `${selected.length} ${selected.length === 1 ? "technology" : "technologies"} selected`
                : "Select technologies…"}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] rounded-xl border-hairline bg-surface-overlay p-0 shadow-xl shadow-black/10 dark:shadow-black/40"
          align="start"
        >
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search technologies…"
              className="border-none text-strong placeholder:text-faint"
            />
            <CommandList>
              <CommandEmpty className="py-6 text-center text-sm text-faint">
                No technology found.
              </CommandEmpty>
              <CommandGroup className="max-h-60 overflow-auto p-1.5">
                {techstackOptions.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer rounded-lg text-strong aria-selected:bg-hover aria-selected:text-strong"
                    >
                      <span
                        className={cn(
                          "mr-2.5 flex size-4 items-center justify-center rounded border transition-colors duration-150",
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-hairline-strong"
                        )}
                        aria-hidden="true"
                      >
                        {isSelected && <Check className="size-3" />}
                      </span>
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {selected.map((item) => (
              <motion.button
                key={item}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleRemove(item)}
                aria-label={`Remove ${item}`}
                className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-raise py-1 pl-3 pr-2 text-xs font-medium text-body transition-colors duration-200 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
              >
                {item}
                <X
                  className="size-3 text-faint transition-colors duration-200 group-hover:text-red-500"
                  aria-hidden="true"
                />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default TechstackMultiSelect;
