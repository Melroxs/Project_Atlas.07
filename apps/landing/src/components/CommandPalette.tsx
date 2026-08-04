"use client";

import { useState, useEffect, useRef } from "react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const prompts = [
  "Where is revenue getting stuck?",
  "Which jobs need attention?",
  "Which claims have stalled?",
  "Which supplements need follow-up?",
  "Which adjusters approve fastest?",
  "What documents are missing?",
  "What supplement opportunities are we missing?",
];

const answers: Record<string, string> = {
  "Where is revenue getting stuck?":
    "Revenue currently waiting: $42,380\n12 supplements awaiting carrier approval.\n3 claims inactive for 21 days.\nRecommended action: Follow up with Carrier X.",
  "Which jobs need attention?":
    "4 claims require immediate attention:\n- NPP-2026-0048: Missing engineer report ($5,200 at risk)\n- NPP-2026-0051: Awaiting carrier response 18 days\n- NPP-2026-0049: Supplement revision needed\n- NPP-2026-0050: Documentation incomplete",
  "Which claims have stalled?":
    "3 claims stalled over 14 days:\n- NPP-2026-0048: 21 days inactive\n- NPP-2026-0051: 18 days awaiting carrier\n- NPP-2026-0047: 16 days pending supplement",
  "Which supplements need follow-up?":
    "12 supplements awaiting carrier response:\n- 5 pending over 14 days\n- 3 require additional documentation\n- 4 awaiting adjuster review\nRecommended: Follow up with Carrier X and Carrier Y",
  "Which adjusters approve fastest?":
    "Top performers:\n1. Michael Turner: 6.1 days average\n2. Sarah Williams: 7.3 days average\n3. David Chen: 8.2 days average\nConfidence: High (based on 127 approvals)",
  "What documents are missing?":
    "Missing documents across 4 claims:\n- Engineer reports: 2\n- Code documentation: 3\n- Photos: 1\n- Invoices: 2\nImpact: $12,400 revenue at risk",
  "What supplement opportunities are we missing?":
    "Atlas identified 3 opportunities:\n- NPP-2026-0048: Potential $3,200 supplement (missed code items)\n- NPP-2026-0051: Potential $1,800 supplement (additional damage)\n- NPP-2026-0049: Potential $2,400 supplement (underestimated)\nTotal potential: $7,400",
};

export default function CommandPalette({
  isOpen,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handlePromptClick = (prompt: string) => {
    setSelectedPrompt(prompt);
    setIsTyping(true);
    setTypedAnswer("");
    typeAnswer(answers[prompt]);
  };

  const typeAnswer = (text: string) => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setTypedAnswer((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, 20);
  };

  const filteredPrompts = prompts.filter((prompt) =>
    prompt.toLowerCase().includes(query.toLowerCase()),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-gray-700">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-lg flex items-center justify-center mr-3">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Atlas..."
            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close command palette"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[500px] overflow-y-auto">
          {!selectedPrompt ? (
            <div className="p-4">
              <p className="text-gray-400 text-sm mb-3">Suggested questions:</p>
              <div className="space-y-2">
                {filteredPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <button
                onClick={() => {
                  setSelectedPrompt(null);
                  setTypedAnswer("");
                }}
                className="text-cyan-400 text-sm mb-4 hover:text-cyan-300 transition-colors"
              >
                ← Back to questions
              </button>
              <div className="bg-black/30 rounded-xl p-4 border border-gray-700">
                <p className="text-gray-400 text-sm mb-2">{selectedPrompt}</p>
                <p className="text-white whitespace-pre-line font-mono text-sm">
                  {typedAnswer}
                </p>
                {isTyping && (
                  <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between text-gray-400 text-sm">
          <div className="flex items-center space-x-4">
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">↑↓</kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">↵</kbd>{" "}
              Select
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">ESC</kbd>{" "}
              Close
            </span>
          </div>
          <span>Atlas Intelligence</span>
        </div>
      </div>
    </div>
  );
}
