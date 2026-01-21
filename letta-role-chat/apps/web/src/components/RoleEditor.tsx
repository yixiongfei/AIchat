
import React, { useState } from "react";
import { X } from "lucide-react";

interface RoleEditorProps {
  onSave: (role: { 
    name: string; 
    persona: string; 
    human: string;
    voice: string;
    speed: number;
    pitch: string;
    style: string;
  }) => void;
  onClose: () => void;
}

export const RoleEditor: React.FC<RoleEditorProps> = ({ onSave, onClose }) => {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [human, setHuman] = useState("");
  const [voice, setVoice] = useState("ja-JP-MayuNeural");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState("15");
  const [style, setStyle] = useState("chat");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ 调试：确认是否真的触发
    console.log("submit fired", { name, persona, human, voice, speed, pitch, style });

    try {
      onSave({ name, persona, human, voice, speed, pitch, style });
      onClose(); // ✅ 保存后关闭弹窗（你想要“点了有反应”通常就是这个）
    } catch (err) {
      console.error("onSave error:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create New Agent</h2>

          {/* ✅ 非提交按钮，一律 type="button" */}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent Name
            </label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Travel Assistant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Persona (System Prompt)
            </label>
            <textarea
              required
              rows={4}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe the agent's personality and role..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Human (User Context)
            </label>
            <textarea
              required
              rows={2}
              value={human}
              onChange={(e) => setHuman(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe the user this agent is interacting with..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voice
              </label>
              <input
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="ja-JP-MayuNeural"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speed
              </label>
              <input
                type="number"
                step="0.1"
                min="0.25"
                max="4.0"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pitch
              </label>
              <input
                type="text"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="chat"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-4"
          >
            Create Agent
          </button>
        </form>
      </div>
    </div>
  );
};
