import { useEffect, useState } from "react";
// 初始化函数 - 在组件外执行，避免闪烁
function getInitialTheme() {
    if (typeof window === "undefined")
        return false;
    const saved = localStorage.getItem("theme");
    if (saved)
        return saved === "dark";
    // 默认暗色主题
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? false : true;
}
export default function useTheme() {
    const [isDark, setIsDark] = useState(() => {
        const initial = getInitialTheme();
        // 立即应用到 DOM，避免闪烁
        if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", initial);
        }
        return initial;
    });
    // 监听系统主题变化
    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e) => {
            // 只有在没有用户偏好设置时才响应系统主题变化
            const saved = localStorage.getItem("theme");
            if (!saved) {
                setIsDark(e.matches);
                document.documentElement.classList.toggle("dark", e.matches);
            }
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);
    const toggleTheme = () => {
        setIsDark((prev) => {
            const next = !prev;
            document.documentElement.classList.toggle("dark", next);
            localStorage.setItem("theme", next ? "dark" : "light");
            console.log(`主题已切换到: ${next ? "暗色" : "亮色"}`);
            return next;
        });
    };
    return { isDark, toggleTheme };
}
