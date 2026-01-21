
import React, { useId, useState } from "react";
import { X } from "lucide-react";

type RolePayload = {
  name: string;
  persona: string;
  human: string;
  voice: string;
  speed: number;
  pitch: string;
  style: string;
};

interface RoleEditorProps {
  // ✅ 允许 onSave 是 async（App 里你是 async）
  onSave: (role: RolePayload) => void | Promise<void>;
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

  // ✅ 为每个表单控件生成唯一 id，解决 axe/forms
  const nameId = useId();
  const personaId = useId();
  const humanId = useId();
  const voiceId = useId();
  const speedId = useId();
  const pitchId = useId();
  const styleId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("submit fired", { name, persona, human, voice, speed, pitch, style });

    try {
      // ✅ 等待保存完成，保存成功再关闭
      await onSave({ name, persona, human, voice, speed, pitch, style });
      onClose();
    } catch (err) {
      console.error("onSave error:", err);
      // 这里你也可以加 toast/提示，避免“点了没反应”的感觉
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create New Agent</h2>

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
            <label
              htmlFor={nameId}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Agent Name
            </label>
            <input
              id={nameId}
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Travel Assistant"
            />
          </div>

          <div>
            <label
              htmlFor={personaId}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Persona (System Prompt)
            </label>
            <textarea
              id={personaId}
              required
              rows={4}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe the agent's personality and role..."
            />
          </div>

          <div>
            <label
              htmlFor={humanId}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Human (User Context)
            </label>
            <textarea
              id={humanId}
              required
              rows={2}
              value={human}
              onChange={(e) => setHuman(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Describe the user this agent is interacting with..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={voiceId}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Voice
              </label>
              <input
                id={voiceId}
                type="text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="ja-JP-MayuNeural"
              />
            </div>

            <div>
              <label
                htmlFor={speedId}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Speed
              </label>
              <input
                id={speedId}
                type="number"
                step="0.1"
                min="0.25"
                max="4.0"
                value={speed}
                // ✅ valueAsNumber 更稳；避免 parseFloat('') => NaN
                onChange={(e) => {
                  const v = e.currentTarget.valueAsNumber;
                  setSpeed(Number.isFinite(v) ? v : 1.0);
                }}
                className="w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={pitchId}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Pitch
              </label>
              <input
                id={pitchId}
                type="text"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="15"
              />
            </div>

            <div>
              <label
                htmlFor={styleId}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Style
              </label>
              <input
                id={styleId}
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
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
