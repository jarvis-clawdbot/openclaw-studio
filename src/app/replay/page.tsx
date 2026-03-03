"use client";

import { useState, useEffect, useRef } from "react";
import { useReplayStore, ReplayEvent, ReplaySession } from "@/stores/replayStore";

const eventColors: Record<string, string> = {
  user_message: "bg-blue-900 border-blue-500",
  assistant_message: "bg-green-900 border-green-500",
  tool_call: "bg-purple-900 border-purple-500",
  tool_result: "bg-slate-700 border-slate-500",
  error: "bg-red-900 border-red-500",
};

export default function ReplayPage() {
  const {
    sessions,
    selectedSession,
    selectSession,
    currentTime,
    setCurrentTime,
    isPlaying,
    setPlaying,
    setSessions,
    playbackSpeed,
    setPlaybackSpeed,
  } = useReplayStore();
  const [visibleEvents, setVisibleEvents] = useState<ReplayEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/replay/sessions");
        if (!res.ok) {
          setSessions([]);
          return;
        }
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      } catch {
        setSessions([]);
      }
    };
    loadSessions();
  }, [setSessions]);

  useEffect(() => {
    if (selectedSession) {
      const events = (selectedSession.events || []).filter((e) => e.timestamp <= currentTime);
      setVisibleEvents(events);
    }
  }, [currentTime, selectedSession]);

  useEffect(() => {
    if (!isPlaying || !selectedSession) return;
    const interval = setInterval(() => {
      setCurrentTime(currentTime + 1000 * playbackSpeed);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, playbackSpeed, selectedSession, setCurrentTime]);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();
  const formatDuration = (start: number, end: number | null) => {
    const duration = (end || Date.now()) - start;
    const mins = Math.floor(duration / 60000);
    const secs = Math.floor((duration % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const handleSessionSelect = async (session: ReplaySession) => {
    setVisibleEvents([]);
    setPlaying(false);
    setLoadingEvents(true);
    selectSession(session);
    setCurrentTime(session.startedAt);
    try {
      const res = await fetch(`http://localhost:8000/api/replay/sessions/${session.id}/events`);
      if (res.ok) {
        const events: ReplayEvent[] = await res.json();
        const enriched = { ...session, events };
        selectSession(enriched);
      }
    } catch (e) {
      console.error("Failed to load replay events:", e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handlePlay = () => {
    if (!selectedSession) return;
    if (currentTime >= (selectedSession.endedAt || Date.now())) {
      setCurrentTime(selectedSession.startedAt);
      setVisibleEvents([]);
    }
    setPlaying(!isPlaying);
  };

  return (
    <div className="h-screen bg-slate-900 flex">
      <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Sessions</h2>
          <p className="text-xs text-slate-400 mt-1">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="p-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSessionSelect(session)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                selectedSession?.id === session.id ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-200"
              }`}
            >
              <div className="font-medium capitalize">{session.agentName}</div>
              <div className="text-xs opacity-75">{formatTime(session.startedAt)}</div>
              <div className="text-xs opacity-75">{(session as any).messageCount ?? session.events?.length ?? 0} events</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {sessions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">No replay sessions available yet</div>
        ) : selectedSession ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingEvents ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                    <p>Loading events...</p>
                  </div>
                </div>
              ) : visibleEvents.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  Press ▶ to start replay
                </div>
              ) : (
              <div className="max-w-3xl mx-auto space-y-2">
                {visibleEvents.map((event) => (
                  <div key={event.id} className={`p-3 rounded-lg border-l-4 ${eventColors[event.type] ?? "bg-slate-800 border-slate-500"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400">{formatTime(event.timestamp)}</span>
                      <span className="text-xs text-slate-300 capitalize">{event.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-white text-sm">{event.content}</div>
                    {event.metadata && (
                      <pre className="mt-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded overflow-x-auto">{JSON.stringify(event.metadata, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>

            <div className="bg-slate-800 border-t border-slate-700 p-4">
              <div className="flex items-center gap-4">
                <button onClick={handlePlay} className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white">
                  {isPlaying ? "⏸" : "▶"}
                </button>
                <div className="flex-1" ref={timelineRef}>
                  <input
                    type="range"
                    min={selectedSession.startedAt}
                    max={selectedSession.endedAt || Date.now()}
                    value={currentTime}
                    onChange={(e) => setCurrentTime(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="bg-slate-700 text-white rounded px-2 py-1">
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                  <option value={10}>10x</option>
                </select>
                <span className="text-slate-400 text-sm">{formatDuration(selectedSession.startedAt, selectedSession.endedAt)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">Select a session to replay</div>
        )}
      </div>
    </div>
  );
}
