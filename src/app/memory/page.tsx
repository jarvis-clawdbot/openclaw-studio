"use client";

import { useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Result = {
  path: string;
  lines: string;
  score: number;
  snippet: string;
};

const EXAMPLE_QUERIES = ["user preferences", "model routing", "cron jobs", "backup", "agent setup"];

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    setError(null);
    if (q) setQuery(q);
    try {
      const res = await fetch(`${BACKEND_URL}/api/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, maxResults: 10, minScore: 0.0 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Memory Search</h1>
        <p className="text-sm text-white/40 mt-1">Search across agent memory files and knowledge base</p>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search memory... (e.g. user preferences, model routing)"
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => search()}
          disabled={loading || !query.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Example queries */}
      {!searched && (
        <div className="mb-6">
          <p className="text-xs text-white/30 mb-2">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => search(q)}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/50 hover:text-white/80 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-4 text-sm text-red-400">
          Search error: {error}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-white/30 text-lg">No results found</p>
          <p className="text-white/20 text-sm mt-2">Try different search terms</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30">{results.length} results found</p>
          {results.map((r, i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-start justify-between mb-2 gap-3">
                <p className="text-sm text-blue-400 font-mono truncate flex-1">{r.path}:{r.lines}</p>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded px-2 py-1 flex-shrink-0">
                  {(r.score * 100).toFixed(0)}% match
                </span>
              </div>
              <pre className="text-sm text-white/70 whitespace-pre-wrap line-clamp-6 overflow-hidden">{r.snippet}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
