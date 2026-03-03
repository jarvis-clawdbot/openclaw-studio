"use client";

import { useEffect, useState, useCallback } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Card = {
  id: number;
  column_id: number;
  title: string;
  description?: string;
  agent_id?: string;
  position: number;
};

type Column = {
  id: number;
  board_id: number;
  name: string;
  position: number;
  cards: Card[];
};

type Board = {
  id: number;
  name: string;
  description?: string;
  group_name?: string;
  columns: Column[];
};

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [newBoardGroup, setNewBoardGroup] = useState("General");
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [addingCardCol, setAddingCardCol] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const load = useCallback(async () => {
    try {
      const [boardsRes, groupsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/boards`),
        fetch(`${BACKEND_URL}/api/boards/groups/list`),
      ]);
      if (boardsRes.ok) {
        const data: Board[] = await boardsRes.json();
        setBoards(data);
        if (data.length > 0 && !selectedBoard) setSelectedBoard(data[0]);
      }
      if (groupsRes.ok) {
        const gd = await groupsRes.json();
        setGroups(["All", ...(gd.groups ?? [])]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredBoards = selectedGroup === "All"
    ? boards
    : boards.filter((b) => (b.group_name || "General") === selectedGroup);

  const createBoard = async () => {
    if (!newBoardName.trim()) return;
    setCreatingBoard(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/boards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBoardName, description: newBoardDesc, group_name: newBoardGroup }),
      });
      if (res.ok) {
        const nb = await res.json();
        setNewBoardName(""); setNewBoardDesc(""); setShowNewBoard(false);
        await load();
        // Reload fresh data to get columns
        const fresh = await fetch(`${BACKEND_URL}/api/boards/${nb.id}`);
        if (fresh.ok) setSelectedBoard(await fresh.json());
      }
    } finally {
      setCreatingBoard(false);
    }
  };

  const deleteBoard = async (boardId: number) => {
    if (!confirm("Delete this board and all its cards?")) return;
    await fetch(`${BACKEND_URL}/api/boards/${boardId}`, { method: "DELETE" });
    setSelectedBoard(null);
    await load();
  };

  const addCard = async (colId: number) => {
    if (!newCardTitle.trim() || !selectedBoard) return;
    const res = await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_id: colId, title: newCardTitle }),
    });
    if (res.ok) {
      setNewCardTitle(""); setAddingCardCol(null);
      const fresh = await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}`);
      if (fresh.ok) setSelectedBoard(await fresh.json());
    }
  };

  const deleteCard = async (cardId: number) => {
    if (!selectedBoard) return;
    await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}/cards/${cardId}`, { method: "DELETE" });
    const fresh = await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}`);
    if (fresh.ok) setSelectedBoard(await fresh.json());
  };

  const addColumn = async () => {
    if (!newColName.trim() || !selectedBoard) return;
    const res = await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColName }),
    });
    if (res.ok) {
      setNewColName(""); setAddingCol(false);
      const fresh = await fetch(`${BACKEND_URL}/api/boards/${selectedBoard.id}`);
      if (fresh.ok) setSelectedBoard(await fresh.json());
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Boards</h1>
            {/* Group filter */}
            <div className="flex gap-1">
              {groups.map((g) => (
                <button key={g} onClick={() => setSelectedGroup(g)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${selectedGroup === g ? "bg-blue-600 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowNewBoard(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            + New Board
          </button>
        </div>

        {/* Board tabs */}
        {filteredBoards.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {filteredBoards.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBoard(b)}
                className={`px-3 py-1.5 rounded text-sm whitespace-nowrap flex items-center gap-1.5 transition-colors ${selectedBoard?.id === b.id ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"}`}
              >
                {b.name}
                {selectedBoard?.id === b.id && (
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteBoard(b.id); }}
                    className="text-red-400 hover:text-red-300 text-xs ml-1 cursor-pointer"
                    title="Delete board"
                  >✕</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Board Modal */}
      {showNewBoard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-96 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">New Board</h3>
            <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="Board name" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-3 text-sm" />
            <input value={newBoardDesc} onChange={(e) => setNewBoardDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-3 text-sm" />
            <input value={newBoardGroup} onChange={(e) => setNewBoardGroup(e.target.value)} placeholder="Group name (e.g. Engineering)" className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white mb-4 text-sm" list="group-suggestions" />
            <datalist id="group-suggestions">
              {groups.filter((g) => g !== "All").map((g) => <option key={g} value={g} />)}
            </datalist>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewBoard(false)} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
              <button onClick={createBoard} disabled={!newBoardName.trim() || creatingBoard} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded text-sm">
                {creatingBoard ? "Creating…" : "Create Board"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-white/30">Loading…</div>
      ) : !selectedBoard ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/30 mb-4">No boards yet</p>
            <button onClick={() => setShowNewBoard(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
              Create Your First Board
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full items-start">
            {selectedBoard.columns.map((col) => (
              <div key={col.id} className="flex-shrink-0 w-72 bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">{col.name}</h3>
                  <span className="text-xs text-white/30">{col.cards.length}</span>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-22rem)] overflow-y-auto">
                  {col.cards.map((card) => (
                    <div key={card.id} className="group bg-slate-800 rounded-lg p-3 border border-white/10 hover:border-white/20">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-white text-sm font-medium leading-snug flex-1">{card.title}</h4>
                        <button onClick={() => deleteCard(card.id)} className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 text-xs shrink-0">✕</button>
                      </div>
                      {card.description && <p className="text-xs text-white/50 mt-1 line-clamp-2">{card.description}</p>}
                      {card.agent_id && <span className="inline-block text-xs bg-blue-500/20 text-blue-400 rounded px-2 py-0.5 mt-1">{card.agent_id}</span>}
                    </div>
                  ))}
                </div>

                {/* Add card */}
                {addingCardCol === col.id ? (
                  <div className="mt-2">
                    <input
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addCard(col.id); if (e.key === "Escape") setAddingCardCol(null); }}
                      placeholder="Card title…"
                      autoFocus
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs mb-1.5"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => addCard(col.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">Add</button>
                      <button onClick={() => { setAddingCardCol(null); setNewCardTitle(""); }} className="px-2 py-1 text-white/40 hover:text-white text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingCardCol(col.id)} className="w-full mt-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded transition-colors">
                    + Add card
                  </button>
                )}
              </div>
            ))}

            {/* Add column */}
            <div className="flex-shrink-0 w-56">
              {addingCol ? (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <input
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") setAddingCol(false); }}
                    placeholder="Column name…"
                    autoFocus
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white text-xs mb-2"
                  />
                  <div className="flex gap-1">
                    <button onClick={addColumn} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs">Add</button>
                    <button onClick={() => { setAddingCol(false); setNewColName(""); }} className="px-2 py-1 text-white/40 hover:text-white text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCol(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-sm rounded-xl border border-white/10 border-dashed transition-colors">
                  + Add column
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
