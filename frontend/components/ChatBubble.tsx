import React from "react";
import ReactMarkdown from "react-markdown";
import { Message } from "../types";
import { Table, TableHead, TableBody, TableRow, TableCell } from "./MarkdownTable";

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full mb-3 sm:mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm text-sm sm:text-base ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-none"
            : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
        }`}
      >
        {/* ZMIANA: Zamiast <p> używamy <ReactMarkdown> z prostym stylowaniem */}
        <div className="text-xs sm:text-sm leading-relaxed markdown-body">
          <ReactMarkdown
            components={{
              // Stylowanie list (Tailwind domyślnie usuwa kropki, więc musimy je dodać)
              ul: ({ node, ...props }) => (
                <ul className="list-disc ml-4 my-2" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal ml-4 my-2" {...props} />
              ),
              // Stylowanie pogrubień
              strong: ({ node, ...props }) => (
                <strong className="font-bold" {...props} />
              ),
              // Stylowanie akapitów (żeby nie były sklejone)
              p: ({ node, ...props }) => (
                <p className="mb-2 last:mb-0" {...props} />
              ),
              // Stylowanie tabel
              table: ({ node, ...props }) => (
                <Table {...props} />
              ),
              thead: ({ node, ...props }) => (
                <TableHead {...props} />
              ),
              tbody: ({ node, ...props }) => (
                <TableBody {...props} />
              ),
              tr: ({ node, ...props }) => {
                // Sprawdź czy jest to header (tr w thead)
                const isHeader = node?.parent?.type === 'tableHead';
                return <TableRow isHeader={isHeader} {...props} />;
              },
              th: ({ node, ...props }) => (
                <TableCell isHeader={true} {...props} />
              ),
              td: ({ node, ...props }) => (
                <TableCell isHeader={false} {...props} />
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        <span
          className={`text-[9px] sm:text-[10px] block mt-1 opacity-60 ${
            isUser ? "text-right" : "text-left"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
};

export default ChatBubble;
