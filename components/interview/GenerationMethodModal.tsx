"use client";

import { Phone, FileText } from "lucide-react";

interface GenerationMethodModalProps {
  isOpen: boolean;
  onSelect: (method: "call" | "form") => void;
}

const GenerationMethodModal = ({
  isOpen,
  onSelect,
}: GenerationMethodModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-white">
          Choose Generation Method
        </h2>
        <p className="text-gray-400 mt-2">
          How would you like to generate your interview?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-sm:grid-cols-1">
        {/* Call Option */}
        <button
          onClick={() => onSelect("call")}
          className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dark-100 bg-dark-300 hover:border-primary-200 hover:bg-dark-100 transition-all cursor-pointer group"
        >
          <div className="p-4 rounded-full bg-primary-200/20 group-hover:bg-primary-200/30 transition-colors">
            <Phone className="h-10 w-10 text-primary-200" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Call Hiring Manager</h3>
            <p className="text-sm text-gray-400 mt-1">
              Speak with AI to describe your interview
            </p>
          </div>
        </button>

        {/* Form Option */}
        <button
          onClick={() => onSelect("form")}
          className="flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-dark-100 bg-dark-300 hover:border-primary-200 hover:bg-dark-100 transition-all cursor-pointer group"
        >
          <div className="p-4 rounded-full bg-primary-200/20 group-hover:bg-primary-200/30 transition-colors">
            <FileText className="h-10 w-10 text-primary-200" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Fill Out Form</h3>
            <p className="text-sm text-gray-400 mt-1">
              Quickly select options from dropdowns
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default GenerationMethodModal;
