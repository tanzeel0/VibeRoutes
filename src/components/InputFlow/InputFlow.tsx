"use client";

import { useRef, useEffect, useState } from "react";
import { Send } from "lucide-react";

interface InputFlowProps {
  onSubmit: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export default function InputFlow({
  onSubmit,
  placeholder = "City, days & vibe — e.g. 4 days in Goa for food & beaches",
  autoFocus = false,
  disabled = false,
}: InputFlowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);

  const handleSubmit = () => {
    if (disabled) return;
    const text = textareaRef.current?.value?.trim();
    if (!text) return;
    onSubmit(text);
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
    setHasText(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
      setHasText(Boolean(ta.value.trim()));
    }
  };

  useEffect(() => {
    if (autoFocus && !disabled) textareaRef.current?.focus();
  }, [autoFocus, disabled]);

  return (
    <div className={`prompt-input-wrapper ${disabled ? "is-disabled" : ""}`}>
      <textarea
        ref={textareaRef}
        className="prompt-textarea"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={1}
        disabled={disabled}
        readOnly={disabled}
        aria-disabled={disabled}
      />
      <button
        className="prompt-submit"
        onClick={handleSubmit}
        aria-label="Send"
        type="button"
        disabled={disabled || !hasText}
      >
        <Send size={18} />
      </button>
    </div>
  );
}
