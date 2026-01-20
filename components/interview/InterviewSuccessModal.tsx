"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

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
      <DialogContent className="sm:max-w-md bg-dark-200 border-dark-200">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success-100" />
            <DialogTitle>Interview Generated!</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Your interview has been successfully created. You can now take the
            interview or share it with others.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Go to Interview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewSuccessModal;
