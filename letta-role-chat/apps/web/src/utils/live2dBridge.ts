
// src/utils/live2dBridge.ts
let hideTimer: number | null = null;

// 读取当前优先级（与 live2d-widget 逻辑一致：sessionStorage key = 'waifu-message-priority'）[1](https://github.com/stevenjoezhang/live2d-widget/blob/master/src/message.ts)
function getCurrentPriority() {
  const raw = sessionStorage.getItem("waifu-message-priority");
  const p = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(p) ? 0 : p;
}

// 等待 waifu DOM 挂载（autoload.js 会插入 waifu 相关 DOM）[2](https://github.com/stevenjoezhang/live2d-widget)
async function waitForTipsEl(timeoutMs = 3000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.getElementById("waifu-tips");
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

// ✅ 普通显示（一次性文本）
export async function showWaifuMessage(
  text: string,
  timeout = 8000,
  priority = 10,
  override = true
) {
  if (!text) return;

  const currentPriority = getCurrentPriority();
  // 与原逻辑一致：override 时严格大于才阻止，否则大于等于阻止 [1](https://github.com/stevenjoezhang/live2d-widget/blob/master/src/message.ts)
  if ((override && currentPriority > priority) || (!override && currentPriority >= priority)) return;

  const tips = await waitForTipsEl();
  if (!tips) return;

  // 清理旧 timer
  if (hideTimer != null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }

  sessionStorage.setItem("waifu-message-priority", String(priority));

  // 更安全：不使用 innerHTML
  tips.textContent = text;
  tips.classList.add("waifu-tips-active"); // 与原逻辑一致 [1](https://github.com/stevenjoezhang/live2d-widget/blob/master/src/message.ts)

  hideTimer = window.setTimeout(() => {
    sessionStorage.removeItem("waifu-message-priority");
    tips.classList.remove("waifu-tips-active");
  }, timeout);
}

/**
 * ✅ 流式显示：你每次传入“累积文本”，它会做节流，避免每个 token 都重置 timer 造成闪烁
 */
const streamState = {
  lastFlush: 0,
  timer: null as number | null,
  pendingText: "",
};

export async function showWaifuStreamUpdate(
  fullText: string,
  opts?: { priority?: number; override?: boolean; throttleMs?: number; timeout?: number }
) {
  streamState.pendingText = fullText;
  const throttleMs = opts?.throttleMs ?? 120;

  const now = Date.now();
  const flush = async () => {
    streamState.lastFlush = Date.now();
    streamState.timer = null;
    await showWaifuMessage(
      streamState.pendingText,
      opts?.timeout ?? 10000, // 流式时长一点，避免中途气泡消失
      opts?.priority ?? 10,
      opts?.override ?? true
    );
  };

  if (now - streamState.lastFlush >= throttleMs) {
    await flush();
  } else if (streamState.timer == null) {
    streamState.timer = window.setTimeout(() => {
      flush();
    }, throttleMs - (now - streamState.lastFlush));
  }
}

export function clearWaifuTimers() {
  if (hideTimer != null) window.clearTimeout(hideTimer);
  hideTimer = null;
  if (streamState.timer != null) window.clearTimeout(streamState.timer);
  streamState.timer = null;
}
