"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type Step = "basic" | "model" | "skills" | "review";

export default function CreateAgentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basic");
  const [formData, setFormData] = useState({
    name: "",
    model: "glm-5",
    thinking: "low",
    skills: [] as string[],
    description: "",
  });

  const availableModels = [
    { id: "glm-5", name: "GLM-5", provider: "Ollama Cloud", cost: "Free" },
    { id: "qwen3.5-plus", name: "Qwen 3.5 Plus", provider: "OpenRouter", cost: "Free" },
    { id: "kimi-k2.5", name: "Kimi K2.5", provider: "OpenRouter", cost: "Free" },
    { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "GitHub Copilot", cost: "$$" },
  ];

  const availableSkills = [
    "canary", "agent-audit", "tavily", "github", "weather",
    "apple-notes", "things-mac", "calendar", "healthcheck"
  ];

  const handleCreate = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: formData.name.toLowerCase().replace(/\s+/g, "-"),
          model: formData.model,
          thinking: formData.thinking,
          skills: formData.skills,
          description: formData.description,
        }),
      });
      if (res.ok) {
        router.push("/");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create New Agent</h1>
          <p className="text-sm text-white/40">Configure your agent in 4 simple steps</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {(["basic", "model", "skills", "review"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex-1 h-1 rounded-full ${
                step === s ? "bg-blue-500" :
                i < (["basic", "model", "skills", "review"].indexOf(step)) ? "bg-blue-500/30" : "bg-white/10"
              }`} />
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          {step === "basic" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Basic Info</h2>
              <div>
                <label className="block text-sm text-white/60 mb-2">Agent Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Research Assistant"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this agent do?"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {step === "model" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Choose Model</h2>
              <div className="space-y-3">
                {availableModels.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setFormData({ ...formData, model: m.id })}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      formData.model === m.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">{m.name}</h3>
                        <p className="text-xs text-white/40">{m.provider}</p>
                      </div>
                      <span className="text-xs text-white/60">{m.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Thinking Level</label>
                <select
                  value={formData.thinking}
                  onChange={(e) => setFormData({ ...formData, thinking: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white outline-none"
                >
                  <option value="off">Off</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          {step === "skills" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Select Skills</h2>
              <div className="grid grid-cols-2 gap-3">
                {availableSkills.map((skill) => (
                  <div
                    key={skill}
                    onClick={() => {
                      const skills = formData.skills.includes(skill)
                        ? formData.skills.filter((s) => s !== skill)
                        : [...formData.skills, skill];
                      setFormData({ ...formData, skills });
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      formData.skills.includes(skill)
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="text-white text-sm">{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Review & Create</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Name:</span>
                  <span className="text-white">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Model:</span>
                  <span className="text-white">{formData.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Thinking:</span>
                  <span className="text-white">{formData.thinking}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Skills:</span>
                  <span className="text-white">{formData.skills.length} selected</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
            <button
              onClick={() => {
                const steps: Step[] = ["basic", "model", "skills", "review"];
                const idx = steps.indexOf(step);
                if (idx > 0) setStep(steps[idx - 1]);
              }}
              disabled={step === "basic"}
              className="px-4 py-2 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={() => {
                const steps: Step[] = ["basic", "model", "skills", "review"];
                const idx = steps.indexOf(step);
                if (idx < steps.length - 1) {
                  setStep(steps[idx + 1]);
                } else {
                  handleCreate();
                }
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium"
            >
              {step === "review" ? "Create Agent" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
