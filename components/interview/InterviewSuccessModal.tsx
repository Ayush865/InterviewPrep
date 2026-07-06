"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface InterviewSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InterviewSuccessModal = ({
  isOpen,
  onClose,
}: InterviewSuccessModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl border-white/[0.1] bg-surface-overlay sm:max-w-md">
        <DialogHeader>
          <div className="flex size-11 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
            <CheckCircle2 className="size-5 text-emerald-400" aria-hidden="true" />
          </div>
          <DialogTitle className="pt-3 text-xl font-semibold tracking-tight text-white">
            Interview ready
          </DialogTitle>
          <DialogDescription className="pt-1 leading-relaxed text-zinc-400">
            Your interview has been created. Take it now to get instant,
            data-backed feedback.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <button onClick={onClose} className="btn-accent w-full">
            Go to interview
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewSuccessModal;
