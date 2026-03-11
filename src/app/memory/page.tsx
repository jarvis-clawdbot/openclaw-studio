"use client";

import { useState } from "react";
import { BACKEND_URL } from "@/lib/config";


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
    <div className="h-screen bg-slate-950 p-6 overflow-auto dashboard-scroll page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Memory Search</h1>
        <p className="text-sm text-white/40 mt-1">Search across agent memory files and knowledge base</p>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search memory... (e.g. user preferences, model routing)"
          className="flex-1 px-4 py-2.5 glass-card text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={() => search()}
          disabled={loading || !query.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Example queries */}
      {!searched && (
        <div className="mb-6">
          <p className="text-xs text-white/20 mb-2">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => search(q)}
                className="text-xs px-3 py-1.5 glass-card hover:bg-white/10 text-white/40 hover:text-white/70 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card bg-red-500/10 border-red-500/20 p-3 mb-4 text-sm text-red-400">
          ⚠ Search error: {error}
        </div>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <div className="glass-card text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-white/40 text-lg">No results found</p>
          <p className="text-white/20 text-sm mt-2">Try different search terms</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-white/30">{results.length} results found</p>
          {results.map((r, i) => (
            <div key={i} className="glass-card p-4 animate-card-enter" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between mb-2 gap-3">
                <p className="text-sm text-blue-400 font-mono truncate flex-1">{r.path}:{r.lines}</p>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-2.5 py-1 flex-shrink-0 border border-emerald-500/20">
                  {(r.score * 100).toFixed(0)}% match
                </span>
              </div>
              <pre className="text-sm text-white/60 whitespace-pre-wrap line-clamp-6 overflow-hidden font-mono bg-white/[0.02] rounded-lg p-3">{r.snippet}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
