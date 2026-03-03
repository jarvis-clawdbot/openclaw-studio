"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Card = {
  id: number;
  title: string;
  description?: string;
  agent_id?: string;
};

type Column = {
  id: number;
  name: string;
  cards: Card[];
};

type Board = {
  id: number;
  name: string;
  description?: string;
  columns: Column[];
};

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/boards`);
        if (res.ok) {
          const data = await res.json();
          setBoards(data);
          if (data.length > 0) setSelectedBoard(data[0]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Boards</h1>
            {boards.length > 0 && (
              <select
                value={selectedBoard?.id || ""}
                onChange={(e) => {
                  const b = boards.find((b) => b.id === Number(e.target.value));
                  if (b) setSelectedBoard(b);
                }}
                className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-white text-sm outline-none"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            + New Board
          </button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/30">
          Loading...
        </div>
      ) : !selectedBoard ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/30 mb-4">No boards yet</p>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
              Create Your First Board
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full">
            {selectedBoard.columns.map((col) => (
              <div
                key={col.id}
                className="flex-shrink-0 w-80 bg-white/5 rounded-xl p-4 border border-white/10"
              >
                {/* Column header */}
                <div className="mb-4">
                  <h3 className="text-white font-semibold mb-1">{col.name}</h3>
                  <p className="text-xs text-white/40">{col.cards.length} cards</p>
                </div>

                {/* Cards */}
                <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  {col.cards.map((card) => (
                    <div
                      key={card.id}
                      className="bg-slate-800 rounded-lg p-3 border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                    >
                      <h4 className="text-white text-sm font-medium mb-1">
                        {card.title}
                      </h4>
                      {card.description && (
                        <p className="text-xs text-white/60 mb-2 line-clamp-2">
                          {card.description}
                        </p>
                      )}
                      {card.agent_id && (
                        <span className="inline-block text-xs bg-blue-500/20 text-blue-400 rounded px-2 py-0.5">
                          {card.agent_id}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add card button */}
                <button className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm rounded-lg transition-colors">
                  + Add Card
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
