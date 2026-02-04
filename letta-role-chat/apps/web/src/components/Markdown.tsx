import React from 'react';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ 
  html: true, 
  linkify: true, 
  typographer: true,
  breaks: true,  // 将单个换行转换为 <br>
});

interface MarkdownProps {
  text: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ text, className }) => {
  const html = React.useMemo(() => {
    try {
      return DOMPurify.sanitize(md.render(text || ''));
    } catch (e) {
      return '';
    }
  }, [text]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default Markdown;
