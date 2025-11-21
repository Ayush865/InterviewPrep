"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Lock } from "lucide-react";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  messageLine1: string;
  messageLine2:string
}

const LimitReachedModal = ({
  isOpen,
  onClose,
  title = "Limit Reached",
  messageLine1,
  messageLine2,
}: LimitReachedModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 bg-dark-300 border border-slate-purple rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <div className="flex flex-col gap-4">
          
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-slate-purple" />
            <h2 className="text-2xl font-bold text-white">{title}</h2>
          </div>
          <p className="text-gray-400">
            {messageLine1}
          </p>
          <p className="text-gray-400">
            {messageLine2}
          </p>
          
          <div className="flex gap-3 mt-2 justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              className="bg-dark-400 hover:bg-dark-500 text-white"
            >
              Cancel
            </Button>
            <Button className="bg-slate-purple hover:bg-cream hover:text-black text-white">
              Upgrade to Premium
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LimitReachedModal;
