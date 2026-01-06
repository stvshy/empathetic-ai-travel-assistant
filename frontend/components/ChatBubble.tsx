import React from "react";
import ReactMarkdown from "react-markdown";
import { Message } from "../types";

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full mb-4 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-none"
            : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
        }`}
      >
        {/* ZMIANA: Zamiast <p> używamy <ReactMarkdown> z prostym stylowaniem */}
        <div className="text-sm leading-relaxed markdown-body">
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
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>

        <span
          className={`text-[10px] block mt-1 opacity-60 ${
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
