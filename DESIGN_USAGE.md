# Premium Design System - Usage Guide

## Quick Reference

### Colors
```tsx
// Primary brand color
const PRIMARY = "#1e2bd6"
const PRIMARY_DARK = "#1a24b8"
const PRIMARY_LIGHT = "#f0f4ff"

// Text colors
const TEXT_PRIMARY = "#0f172a"
const TEXT_SECONDARY = "#475569"
const TEXT_MUTED = "#94a3b8"

// Use in Tailwind
className="bg-[#1e2bd6] hover:bg-[#1a24b8] text-[#0f172a]"
```

---

## Buttons

### Primary Button
```tsx
<button className="btn-premium btn-premium-primary px-8 py-3 rounded-lg">
  Click me
</button>

// States
- Hover: Darker color + shadow lift
- Active: Scale 0.95
- Disabled: opacity 0.5 + cursor not-allowed
```

### Secondary Button
```tsx
<button className="btn-premium btn-premium-secondary px-8 py-3 rounded-lg">
  Click me
</button>

// Subtle background + border, less aggressive
```

### Ghost Button
```tsx
<button className="btn-premium btn-premium-ghost px-8 py-3 rounded-lg">
  Click me
</button>

// Transparent, text-only style
```

---

## Loading States

### Chat Message Skeleton
```tsx
import { ChatMessageSkeleton } from "@/components/ChatSkeleton"

<ChatMessageSkeleton />
```

### Chat Input Skeleton
```tsx
import { ChatInputSkeleton } from "@/components/ChatSkeleton"

<ChatInputSkeleton />
```

### Chat History Skeleton
```tsx
import { ChatHistorySkeleton } from "@/components/ChatSkeleton"

<ChatHistorySkeleton />
```

### Custom Skeleton
```tsx
<div className="skeleton skeleton-text" />  // Text line
<div className="skeleton skeleton-avatar" /> // Avatar circle
<div className="skeleton skeleton-card" />   // Full card
```

---

## Empty States

```tsx
import { EmptyState } from "@/components/EmptyState"

<EmptyState
  type="no-chats"
  title="No chats yet"
  description="Start creating floor plans by sending your first prompt"
  action={{
    label: "Create first design",
    onClick: () => handleNewChat()
  }}
/>

// Types: "no-chats" | "no-generations" | "error"
```

---

## Error & Success States

```tsx
import { ErrorState, SuccessState } from "@/components/ErrorState"

// Error
<ErrorState
  title="Generation failed"
  message="Please try again with a different prompt"
  onDismiss={() => setError(null)}
  actions={[
    { label: "Retry", onClick: handleRetry },
    { label: "Use example", onClick: handleExample, variant: "secondary" }
  ]}
/>

// Success
<SuccessState
  title="Design saved"
  message="Your floor plan has been saved to your library"
  onDismiss={() => setSuccess(false)}
/>
```

---

## Form Validation

```tsx
// Error state
<input 
  type="text" 
  className="input error"
  placeholder="Enter something"
/>

// Success state
<input 
  type="text" 
  className="input success"
  value="Valid input"
/>

// Focus state automatically applied - no extra classes needed
```

---

## Cards

```tsx
<div className="card-premium">
  <h3 className="font-semibold text-[#0f172a]">Card Title</h3>
  <p className="text-[#475569] mt-2">Card content here</p>
</div>
```

---

## Typography

```tsx
// Primary text
<span className="text-[#0f172a] font-semibold">Primary</span>

// Secondary text
<span className="text-[#475569] font-medium">Secondary</span>

// Muted text
<span className="text-[#94a3b8] text-sm">Muted</span>

// Gradient text (premium feel)
<span className="text-gradient-primary font-bold">Gradient Text</span>
```

---

## Spacing

Always use 8px multiples:

```tsx
// Margins
className="m-4 m-8 m-16 m-24 m-32 m-48"

// Padding
className="p-4 p-8 p-16 p-24 p-32 p-48"

// Gaps
className="gap-4 gap-8 gap-16 gap-24 gap-32"

// Or use custom spacing classes
className="spacing-md" // 16px margin + padding
className="gap-lg"    // 24px gap
```

---

## Animations

```tsx
// Fade in
<div className="animate-fade-in">Content</div>

// Slide up
<div className="animate-slide-up">Content</div>

// Slide down
<div className="animate-slide-down">Content</div>

// Pulse (subtle)
<div className="animate-pulse-subtle">Content</div>

// Page transition
<div className="page-transition">Content</div>
```

---

## Dividers

```tsx
<div className="divider-premium" />
```

---

## Focus & Accessibility

```tsx
// Automatically applied to all interactive elements
// - 2px outline in primary color
// - 2px offset
// - 4px offset for buttons

// No need for additional classes - built into base styles
```

---

## Tooltips (Data Attributes)

```tsx
<button data-tooltip="This is a tooltip">
  Hover me
</button>
```

---

## Spinners

```tsx
// Premium spinner
<div className="spinner-premium" />
```

---

## Common Patterns

### Loading Button
```tsx
<button 
  disabled={isLoading}
  className="btn-premium btn-premium-primary"
>
  <div className="flex items-center gap-2">
    {isLoading && <div className="spinner-premium" />}
    <span>{isLoading ? "Loading..." : "Submit"}</span>
  </div>
</button>
```

### Input with Validation
```tsx
<div>
  <input 
    type="email"
    className={`px-4 py-3 rounded-lg border-2 transition-all ${
      error ? "error" : success ? "success" : "border-[#cbd5e1]"
    }`}
    value={value}
    onChange={handleChange}
  />
  {error && <ErrorState title="Validation Error" message={error} />}
  {success && <SuccessState title="Valid input" message="" />}
</div>
```

### List with Skeletons
```tsx
{isLoading ? (
  <ChatHistorySkeleton />
) : items.length === 0 ? (
  <EmptyState type="no-chats" title="No items" description="..." />
) : (
  <ul className="space-y-2">
    {items.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)}
```

---

## CSS Custom Properties

If needed, access color variables:
```css
.my-element {
  color: var(--primary-color);        /* #1e2bd6 */
  background: var(--bg-subtle);       /* #f8fafc */
  border-color: var(--border-light);  /* #e2e8f0 */
}
```

---

## Migration Checklist

- [ ] Replace all custom buttons with `.btn-premium-*`
- [ ] Update color values to primary `#1e2bd6`
- [ ] Use 8px spacing consistently
- [ ] Add skeleton loaders to async content
- [ ] Add empty states where applicable
- [ ] Use error/success state components
- [ ] Remove all emoji from text (keep only in designs)
- [ ] Test focus states for accessibility
- [ ] Verify animations perform well on mobile
- [ ] Test dark mode only works on `/chatbot`

---

## Performance Notes

- Skeletons use CSS animations (no JS overhead)
- Transitions are 200-300ms (fast enough to feel responsive)
- No 60fps animations - subtle, human-like motion
- GPU-accelerated: transforms, opacity only
- No layout shifts - all states pre-calculate space

---

## Troubleshooting

**Colors look different?**
- Clear browser cache
- Check CSS load order in globals.css
- Verify `#1e2bd6` is used, not variables

**Animations too fast/slow?**
- Adjust transition duration in inline styles
- Use `transition-none` class if needed
- Check framer-motion duration props

**Dark mode appearing outside chatbot?**
- Ensure `html.dark` class is only on `/chatbot` route
- Check `color-scheme: light only` in globals.css
- Clear dark mode preference from localStorage

