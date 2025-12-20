// src/components/TypingIndicator.tsx
export default function TypingIndicator() {
  return (
    <div className="flex items-center space-x-2 mt-2">
      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.15s" }} />
      <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.3s" }} />
    </div>
  );
}

