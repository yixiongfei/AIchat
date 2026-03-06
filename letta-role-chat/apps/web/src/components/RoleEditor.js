import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState, useEffect } from "react";
import { X } from "lucide-react";
export const RoleEditor = ({ onSave, onClose, initialRole }) => {
    const [name, setName] = useState("");
    const [persona, setPersona] = useState("");
    const [human, setHuman] = useState("");
    const [voice, setVoice] = useState("ja-JP-MayuNeural");
    const [speed, setSpeed] = useState(1.0);
    const [pitch, setPitch] = useState("15");
    const [style, setStyle] = useState("chat");
    const [avatarBase64, setAvatarBase64] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    // 如果提供了 initialRole，则用于编辑模式，预填表单
    useEffect(() => {
        if (!initialRole)
            return;
        setName(initialRole.name || "");
        setPersona(initialRole.persona || "");
        setHuman(initialRole.human || "");
        setVoice(initialRole.voice || "ja-JP-MayuNeural");
        setSpeed(typeof initialRole.speed === 'number' ? initialRole.speed : 1.0);
        setPitch(initialRole.pitch || "15");
        setStyle(initialRole.style || "chat");
        // initialRole.avatar is a URL; show as preview
        if (initialRole.avatar)
            setAvatarPreview(initialRole.avatar);
    }, [initialRole]);
    // ✅ 为每个表单控件生成唯一 id，解决 axe/forms
    const nameId = useId();
    const personaId = useId();
    const humanId = useId();
    const voiceId = useId();
    const speedId = useId();
    const pitchId = useId();
    const styleId = useId();
    const avatarId = useId();
    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("submit fired", { name, persona, human, voice, speed, pitch, style });
        try {
            // ✅ 等待保存完成，保存成功再关闭
            await onSave({ name, persona, human, voice, speed, pitch, style, avatarBase64 });
            onClose();
        }
        catch (err) {
            console.error("onSave error:", err);
            // 这里你也可以加 toast/提示，避免“点了没反应”的感觉
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-xl w-full max-w-md p-6 shadow-2xl", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-gray-800", children: initialRole ? 'Edit Agent' : 'Create New Agent' }), _jsx("button", { type: "button", onClick: onClose, className: "text-gray-400 hover:text-gray-600", "aria-label": "Close", children: _jsx(X, { size: 24 }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: nameId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Agent Name" }), _jsx("input", { id: nameId, required: true, type: "text", value: name, onChange: (e) => setName(e.target.value), className: "w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none", placeholder: "e.g. Travel Assistant" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: personaId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Persona (System Prompt)" }), _jsx("textarea", { id: personaId, required: true, rows: 4, value: persona, onChange: (e) => setPersona(e.target.value), readOnly: !!initialRole, title: initialRole ? 'Persona cannot be edited in edit mode' : undefined, className: `w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${initialRole ? 'bg-slate-50 cursor-not-allowed' : ''}`, placeholder: "Describe the agent's personality and role..." })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: humanId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Human (User Context)" }), _jsx("textarea", { id: humanId, required: true, rows: 2, value: human, onChange: (e) => setHuman(e.target.value), readOnly: !!initialRole, title: initialRole ? 'User Context cannot be edited in edit mode' : undefined, className: `w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none resize-none ${initialRole ? 'bg-slate-50 cursor-not-allowed' : ''}`, placeholder: "Describe the user this agent is interacting with..." })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: voiceId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Voice" }), _jsx("input", { id: voiceId, type: "text", value: voice, onChange: (e) => setVoice(e.target.value), className: "w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none", placeholder: "ja-JP-MayuNeural" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: speedId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Speed" }), _jsx("input", { id: speedId, type: "number", step: "0.1", min: "0.25", max: "4.0", value: speed, 
                                            // ✅ valueAsNumber 更稳；避免 parseFloat('') => NaN
                                            onChange: (e) => {
                                                const v = e.currentTarget.valueAsNumber;
                                                setSpeed(Number.isFinite(v) ? v : 1.0);
                                            }, className: "w-full border rounded-lg px-3 py-2 text-black focus:ring-2 focus:ring-blue-500 outline-none" })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: avatarId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Avatar (optional)" }), _jsx("input", { id: avatarId, type: "file", accept: "image/*", title: "Upload avatar", onChange: (e) => {
                                        const f = e.target.files?.[0];
                                        if (!f)
                                            return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                            const res = reader.result;
                                            setAvatarBase64(res);
                                            setAvatarPreview(res);
                                        };
                                        reader.readAsDataURL(f);
                                    }, className: "w-full" }), avatarPreview && (_jsx("img", { src: avatarPreview, alt: "avatar preview", className: "mt-2 h-20 w-20 rounded-md object-cover" }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: pitchId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Pitch" }), _jsx("input", { id: pitchId, type: "text", value: pitch, onChange: (e) => setPitch(e.target.value), className: "w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none", placeholder: "15" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: styleId, className: "block text-sm font-medium text-gray-700 mb-1", children: "Style" }), _jsx("input", { id: styleId, type: "text", value: style, onChange: (e) => setStyle(e.target.value), className: "w-full border rounded-lg px-3 py-2 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none", placeholder: "chat" })] })] }), _jsx("button", { type: "submit", className: "w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-4", children: initialRole ? 'Save Changes' : 'Create Agent' })] })] }) }));
};
