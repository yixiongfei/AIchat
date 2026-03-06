import { useCallback, useSyncExternalStore } from "react";
const loadingMap = new Map();
const listeners = new Set();
function emitChange() {
    listeners.forEach((fn) => fn());
}
/** 设置某个 agent 开始加载 */
export function setAgentLoading(agentId, message) {
    loadingMap.set(agentId, { startTime: Date.now(), message });
    emitChange();
}
/** 设置某个 agent 加载完成 */
export function clearAgentLoading(agentId) {
    if (loadingMap.has(agentId)) {
        loadingMap.delete(agentId);
        emitChange();
    }
}
/** 检查某个 agent 是否正在加载 */
export function isAgentLoading(agentId) {
    return loadingMap.has(agentId);
}
/** 获取所有正在加载的 agent */
export function getLoadingAgents() {
    return Array.from(loadingMap.keys());
}
/** 获取加载中 agent 的数量（不包括当前显示的） */
export function getBackgroundLoadingCount(excludeAgentId) {
    let count = 0;
    loadingMap.forEach((_, id) => {
        if (id !== excludeAgentId)
            count++;
    });
    return count;
}
/** 获取加载详情 */
export function getLoadingInfo(agentId) {
    return loadingMap.get(agentId);
}
// 用于 useSyncExternalStore 的 snapshot
function getSnapshot() {
    return loadingMap;
}
function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}
/**
 * Hook: 获取后台 loading 状态
 * @param currentAgentId 当前显示的 agent ID（可选，用于排除）
 * @returns 后台正在加载的 agent 数量和 ID 列表
 */
export function useBackgroundLoading(currentAgentId) {
    // 使用 useSyncExternalStore 订阅全局状态变化
    const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const allLoadingAgents = Array.from(map.keys());
    const backgroundLoadingAgents = allLoadingAgents.filter((id) => id !== currentAgentId);
    const isCurrentLoading = currentAgentId ? map.has(currentAgentId) : false;
    return {
        /** 后台正在加载的 agent 数量（不包括当前） */
        backgroundCount: backgroundLoadingAgents.length,
        /** 后台正在加载的 agent ID 列表 */
        backgroundAgentIds: backgroundLoadingAgents,
        /** 所有正在加载的 agent ID 列表（包括当前） */
        allLoadingAgentIds: allLoadingAgents,
        /** 当前 agent 是否正在加载 */
        isCurrentLoading,
        /** 是否有任何后台请求 */
        hasBackgroundLoading: backgroundLoadingAgents.length > 0,
    };
}
/**
 * Hook: 管理单个 agent 的 loading 状态
 * 用于在 useChatStream 中替代本地 isLoading
 */
export function useAgentLoading(agentId) {
    const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const isLoading = map.has(agentId);
    const info = map.get(agentId);
    const setLoading = useCallback((loading, message) => {
        if (loading) {
            setAgentLoading(agentId, message);
        }
        else {
            clearAgentLoading(agentId);
        }
    }, [agentId]);
    return {
        isLoading,
        setLoading,
        startTime: info?.startTime,
        message: info?.message,
    };
}
