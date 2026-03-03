"use client";

/**
 * MentionsInput - Agent mentions in chat (@agent).
 * Simplified version without external dependencies.
 */

import { useState, useRef } from "react";

type Agent = {
  id: string;
  name: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  agents: Agent[];
  placeholder?: string;
  className?: string;
};

export function MentionsInput({ value, onChange, agents, placeholder, className = "" }: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    a.id.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    onChange(newValue);

    // Check for @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");

    if (lastAt >= 0) {
      const afterAt = textBeforeCursor.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setMentionStart(lastAt);
        setMentionQuery(afterAt);
        setShowSuggestions(true);
        return;
      }
    }

    setShowSuggestions(false);
  };

  const insertMention = (agent: Agent) => {
    if (mentionStart < 0) return;

    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + mentionQuery.length + 1);
    const newValue = `${before}@${agent.id} ${after}`;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery("");

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && e.key === "Escape") {
      setShowSuggestions(false);
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={3}
      />

      {showSuggestions && filteredAgents.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 w-full max-w-sm bg-slate-800 border border-white/20 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 text-xs text-white/40 border-b border-white/10">
            Mention agent
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => insertMention(agent)}
                className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors"
              >
                <div className="text-sm text-white font-medium">@{agent.id}</div>
                <div className="text-xs text-white/40">{agent.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MentionsInput;
