import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true, // 将单个换行转换为 <br>
});
export const Markdown = ({ text, className }) => {
    const html = React.useMemo(() => {
        try {
            return DOMPurify.sanitize(md.render(text || ''));
        }
        catch (e) {
            return '';
        }
    }, [text]);
    return _jsx("div", { className: className, dangerouslySetInnerHTML: { __html: html } });
};
export default Markdown;
