# Chatbot Integration Guide - Premium Design Implementation

## Overview
Guide for integrating the new premium design system components into the chatbot page for a seamless, polished experience.

---

## 1. Assistant Status Display (Already Updated)

### Current Implementation
```tsx
// Location: app/chatbot/page.tsx ~1490

{isLoading && (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    className="flex justify-start"
  >
    <div className="chat-bubble-assistant text-gray-700 dark:text-gray-300 p-3 sm:p-4 rounded-2xl shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-[#1e2bd6]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1e2bd6] border-r-[#1e2bd6] animate-spin" />
        </div>
        <motion.span
          key={isTurnInFlight ? assistantStatusLine : "clairvyn-thinking"}
          initial={{ opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-0 flex-1"
        >
          {isTurnInFlight ? assistantStatusLine : "Processing your request"}
        </motion.span>
      </div>
    </div>
  </motion.div>
)}
```

**Changes made:**
- Custom spinner (no Loader2 icon)
- Better text contrast
- Improved spacing (`gap-3` instead of `gap-2`)
- More readable font size and weight
- Natural animation timing

---

## 2. Empty Chat State Implementation

### Add to Chatbot Page
```tsx
import { EmptyState } from "@/components/EmptyState"

// In your render, before chat messages:
{messages.length === 0 && !isLoading ? (
  <EmptyState
    type="no-chats"
    title="Start designing with AI"
    description="Describe your floor plan requirements and let AI help you create beautiful architectural designs"
    action={{
      label: "View examples",
      onClick: () => showExamples()
    }}
  />
) : (
  // Existing message rendering
)}
```

### Styling
- Dashed border in primary color
- Gradient background (subtle blue tint)
- Centered content
- Optional CTA button

---

## 3. Loading Chat History

### Implementation
```tsx
import { ChatHistorySkeleton } from "@/components/ChatSkeleton"

// Replace hardcoded loading with:
{isLoadingHistory ? (
  <ChatHistorySkeleton />
) : chatHistory.length === 0 ? (
  <EmptyState
    type="no-chats"
    title="No previous designs"
    description="Your design history will appear here"
  />
) : (
  <ul className="space-y-2">
    {chatHistory.map(chat => (
      <ChatHistoryItem key={chat.id} chat={chat} />
    ))}
  </ul>
)}
```

### Features
- Staggered animation (5 skeleton items)
- Smooth fade-in
- Natural timing (50ms stagger between items)

---

## 4. Generation Failure State

### Implementation
```tsx
import { ErrorState } from "@/components/ErrorState"

// In error handling:
{generationError && (
  <ErrorState
    title="Generation failed"
    message={generationError.message}
    onDismiss={() => setGenerationError(null)}
    actions={[
      {
        label: "Try again",
        onClick: handleRetry
      },
      {
        label: "Use template",
        onClick: handleTemplate,
        variant: "secondary"
      }
    ]}
  />
)}
```

### Design
- Red accent color (`#dc2626`)
- 5% opacity background
- Icon + message layout
- Action buttons
- Dismiss button

---

## 5. Generation Success Message

### Implementation
```tsx
import { SuccessState } from "@/components/ErrorState"

// After successful generation:
{generationSuccess && (
  <SuccessState
    title="Design generated successfully"
    message="Your floor plan is ready to view and edit"
    onDismiss={() => setGenerationSuccess(false)}
  />
)}
```

### Design
- Green accent color (`#10b981`)
- Checkmark icon
- Auto-dismiss after 3-4 seconds
- Smooth exit animation

---

## 6. Chat Message Skeleton (While Streaming)

### Implementation
```tsx
import { ChatMessageSkeleton } from "@/components/ChatSkeleton"

// While waiting for model response:
{isFetchingResponse && (
  <ChatMessageSkeleton />
)}
```

### Features
- 4 animated lines (simulating message)
- Shimmer gradient animation
- Smooth staggered reveal
- Natural width variations

---

## 7. Input Loading State

### Implementation
```tsx
import { ChatInputSkeleton } from "@/components/ChatSkeleton"

// While processing input:
{isProcessingInput ? (
  <ChatInputSkeleton />
) : (
  // Normal input field
)}
```

---

## 8. Button State Examples

### Primary Action (Send Button)
```tsx
<button
  disabled={inputValue.trim() === "" || isLoading}
  className="btn-premium btn-premium-primary px-6 py-2.5 rounded-lg text-sm"
  onClick={handleSend}
>
  {isLoading ? "Generating..." : "Generate"}
</button>
```

**States:**
- Normal: Full color gradient
- Hover: Darker gradient + shadow lift
- Active: Scale 0.95
- Disabled: 50% opacity (when input empty or loading)

### Secondary Actions (Clear, Retry)
```tsx
<button
  className="btn-premium btn-premium-secondary px-6 py-2.5 rounded-lg text-sm"
  onClick={handleClear}
>
  Clear chat
</button>
```

### Ghost Actions (Help, Settings)
```tsx
<button
  className="btn-premium btn-premium-ghost text-sm"
  onClick={handleHelp}
>
  Need help?
</button>
```

---

## 9. Form Validation Example

### Input with Validation
```tsx
const [prompt, setPrompt] = useState("")
const [promptError, setPromptError] = useState("")
const [isValidPrompt, setIsValidPrompt] = useState(false)

const handlePromptChange = (e) => {
  const value = e.target.value
  setPrompt(value)
  
  // Validation
  if (value.length < 10) {
    setPromptError("Prompt must be at least 10 characters")
    setIsValidPrompt(false)
  } else {
    setPromptError("")
    setIsValidPrompt(true)
  }
}

// In JSX:
<div>
  <textarea
    value={prompt}
    onChange={handlePromptChange}
    className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
      promptError 
        ? "error" 
        : isValidPrompt 
          ? "success" 
          : "border-[#cbd5e1]"
    }`}
    placeholder="Describe your floor plan..."
  />
  
  {promptError && (
    <ErrorState
      title="Invalid prompt"
      message={promptError}
    />
  )}
  
  {isValidPrompt && (
    <SuccessState
      title="Prompt looks good"
      message="Ready to generate design"
    />
  )}
</div>
```

---

## 10. Chat Bubble Styling (Already Implemented)

### User Message
```tsx
className="chat-bubble-user"
// - Gradient white background
// - Light blue borders
// - Soft shadow
// - Hover elevation effect
```

### Assistant Message
```tsx
className="chat-bubble-assistant"
// - Subtle gradient background
// - Purple-tinted borders
// - Soft shadow
// - Hover elevation effect
```

Both have:
- Smooth transitions
- Transform on hover (translateY -1px)
- Enhanced shadow on hover

---

## 11. Color Adjustments for Chatbot

### Primary Color Usage
```tsx
// Spinners
className="text-[#1e2bd6]"

// Buttons
className="bg-[#1e2bd6] hover:bg-[#1a24b8]"

// Borders
className="border-[#1e2bd6]/40"

// Text links
className="text-[#1e2bd6] hover:text-[#1a24b8]"
```

### Dark Mode (Chatbot Only)
```tsx
// Dark variants still work:
className="dark:text-gray-200"
className="dark:bg-gray-800"

// But page forces light outside chatbot
```

---

## 12. Animation Timing Consistency

### Standard Transitions
```tsx
// For all state changes
transition={{
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1]  // cubic-bezier
}}

// For more visible changes
transition={{
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1]
}}
```

### No Animation (When Not Needed)
```tsx
transition={{ duration: 0 }}
className="transition-none"
```

---

## 13. Accessibility in Chatbot

### Focus States
```tsx
// Automatically applied via globals.css
// 2px outline in #1e2bd6
// 2px offset for visibility

<button>
  {/* Focus visible style automatic */}
</button>
```

### ARIA Labels
```tsx
<button aria-label="Send message" onClick={handleSend}>
  <SendIcon />
</button>

<div role="status" aria-live="polite">
  {statusMessage}
</div>

<div role="complementary" aria-label="Chat history">
  {/* History sidebar */}
</div>
```

### Keyboard Navigation
```tsx
// Tab through: Send button → Input field → History
// Enter to send
// Escape to close modals
```

---

## 14. Performance Optimizations

### Memoization
```tsx
const MemoizedChatBubble = React.memo(ChatBubble)
const MemoizedEmptyState = React.memo(EmptyState)
```

### Lazy Loaded Components
```tsx
const ChatHistory = React.lazy(() => import("./ChatHistory"))
const Suspense loading={<ChatHistorySkeleton />}
```

### Animation Performance
```tsx
// Use CSS animations (GPU accelerated)
@keyframes skeleton-loading {
  /* Applied in globals.css */
}

// Avoid JS-based animations for loading
// Use framer-motion for important interactions only
```

---

## 15. Testing Checklist

- [ ] Empty state shows when no messages
- [ ] Loading skeleton appears while fetching
- [ ] Assistant status updates smoothly
- [ ] Error state displays on generation fail
- [ ] Success state shows on generation complete
- [ ] Buttons disable/enable correctly
- [ ] Animations smooth on mobile (60fps)
- [ ] Focus states visible on keyboard nav
- [ ] Dark mode only works on chatbot page
- [ ] Colors match design system (#1e2bd6)
- [ ] Spacing follows 8px grid
- [ ] Form validation shows error/success states

---

## Summary

The new design system brings:
1. **Consistency** - Colors, spacing, animations unified
2. **Premium Feel** - Subtle animations, smooth transitions
3. **Accessibility** - Proper focus states, ARIA labels
4. **Performance** - CSS animations, optimized rendering
5. **Maintainability** - Reusable components, clear patterns

All components are ready to integrate. Follow the examples above for a cohesive, professional experience.

