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
        content: "Clairvyn generates residential floor plans from your description.\n\nWhat it does:\n• Up to 4 BHK layouts\n• Includes core rooms and spaces\n• Edit after generation: resize, move, adjust\n\nIn progress: electrical, plumbing, structural, multi-floor, more rooms\n\nStart by describing area, rooms, and requirements.",
        timestamp: new Date().toISOString()
      });
      setTyping(false);
    }, 1000);
    return true;
  }
  
  // Return false if no special handling was done — unrelated prompt gets capability brief
  const isFloorPlanRelated =
    normalized.includes("bhk") ||
    normalized.includes("flat") ||
    normalized.includes("villa") ||
    normalized.includes("apartment") ||
    normalized.includes("studio") ||
    normalized.includes("floor plan") ||
    normalized.includes("floorplan") ||
    normalized.includes("sq ft") ||
    normalized.includes("sqft") ||
    normalized.includes("bedroom") ||
    normalized.includes("room") ||
    normalized.includes("house") ||
    normalized.includes("home") ||
    normalized.includes("design") ||
    normalized.includes("layout") ||
    normalized.includes("kitchen") ||
    normalized.includes("bathroom") ||
    normalized.includes("balcony") ||
    normalized.includes("garage") ||
    normalized.includes("vastu") ||
    normalized.includes("facing") ||
    normalized.includes("north") ||
    normalized.includes("south") ||
    normalized.includes("east") ||
    normalized.includes("west") ||
    normalized.includes("resize") ||
    normalized.includes("move") ||
    normalized.includes("rotate") ||
    normalized.includes("add") ||
    normalized.includes("make")

  if (!isFloorPlanRelated) {
    addMessage({
      id: Date.now(),
      role: "assistant",
      content: `Clairvyn generates residential floor plans from your description.\n\nWhat it does:\n• Up to 4 BHK layouts\n• Includes core rooms and spaces\n• Edit after generation: resize, move, adjust\n\nIn progress: electrical, plumbing, structural, multi-floor, more rooms\n\nStart by describing area, rooms, and requirements.`,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  return false;
}
