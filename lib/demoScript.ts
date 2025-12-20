// Demo script for handling special inputs in the chatbot
export function handleScriptedInput(
  input: string, 
  { addMessage, setTyping }: { addMessage: (message: any) => void, setTyping: (typing: boolean) => void }
): boolean {
  const normalized = input.toLowerCase().trim();
  
  // Handle demo commands
  if (normalized.includes('demo') || normalized.includes('example')) {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now(),
        type: 'assistant',
        content: "Here's a demo of how I can help you with architectural design! Try asking me to create a floor plan for a small apartment or help you with CAD modeling.",
        timestamp: new Date().toISOString()
      });
      setTyping(false);
    }, 1000);
    return true;
  }
  
  // Handle help commands
  if (normalized.includes('help') || normalized === '?') {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now(),
        type: 'assistant',
        content: "I can help you with:\n• Floor plan design and layout\n• CAD modeling assistance\n• Architectural drawings\n• Building specifications\n• Design feedback and suggestions\n\nJust describe what you need and I'll assist you!",
        timestamp: new Date().toISOString()
      });
      setTyping(false);
    }, 1000);
    return true;
  }
  
  // Handle greeting commands
  if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('hey')) {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now(),
        type: 'assistant',
        content: "Hello! I'm your AI architectural assistant. I can help you design floor plans, create CAD models, and provide guidance on architectural projects. What would you like to work on today?",
        timestamp: new Date().toISOString()
      });
      setTyping(false);
    }, 1000);
    return true;
  }
  
  // Return false if no special handling was done
  return false;
}
