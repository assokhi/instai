"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (username: string) => void;
}

function extractUsername(input: string): string {
  let value = input.trim();

  // Handle pasted Instagram URLs: https://instagram.com/username/...
  const urlMatch = value.match(
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/
  );
  if (urlMatch) {
    value = urlMatch[1];
  }

  // Strip leading @ if present
  if (value.startsWith("@")) {
    value = value.slice(1);
  }

  return value.toLowerCase().trim();
}

const USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const username = extractUsername(input);
    if (!username) {
      setError("Please enter a username");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setError("Invalid username. Only letters, numbers, dots, and underscores.");
      return;
    }

    setLoading(true);
    onSearch(username);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg mx-auto px-4">
      {/* Title */}
      <h1 className="text-6xl sm:text-7xl font-extralight tracking-tight text-zinc-900 dark:text-zinc-100 select-none">
        INSTAI
      </h1>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex items-center border-2 border-zinc-300 dark:border-zinc-600 rounded-full px-4 py-3 bg-white dark:bg-zinc-900 transition-all focus-within:border-zinc-500 dark:focus-within:border-zinc-400">
          {/* Instagram icon */}
          <div className="flex-shrink-0 mr-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <defs>
                <radialGradient id="ig-gradient" cx="30%" cy="107%" r="150%">
                  <stop offset="0%" stopColor="#fdf497" />
                  <stop offset="5%" stopColor="#fdf497" />
                  <stop offset="45%" stopColor="#fd5949" />
                  <stop offset="60%" stopColor="#d6249f" />
                  <stop offset="90%" stopColor="#285AEB" />
                </radialGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-gradient)" strokeWidth="2" />
              <circle cx="12" cy="12" r="5" stroke="url(#ig-gradient)" strokeWidth="2" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-gradient)" />
            </svg>
          </div>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError("");
            }}
            placeholder="search username"
            className="flex-1 bg-transparent text-zinc-900 dark:text-zinc-100 text-base placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Search button */}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 ml-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-zinc-400 border-t-zinc-700 dark:border-t-zinc-200 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-xs mt-2 text-center">{error}</p>
        )}
      </form>

      {/* Footer */}
      <p className="flex items-center gap-1.5 text-sm text-zinc-400">
        <svg className="w-4 h-4 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        made by @assokhi
      </p>
    </div>
  );
}
