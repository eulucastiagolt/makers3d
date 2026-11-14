import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ChatMarkdown({ text }: { text: string }) {
  return <div className="chat-markdown">
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      disallowedElements={['img']}
      components={{
        a: ({ children }) => <span className="text-gold underline decoration-gold/50">{children}</span>,
        table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
      }}
    >{text}</Markdown>
  </div>;
}
