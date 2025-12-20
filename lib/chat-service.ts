import { v4 as uuidv4 } from 'uuid';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY = 'clairvyn_chat_sessions';

// Helper to get sessions from local storage
const getSessionsFromStorage = (): ChatSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const sessions = JSON.parse(stored);
    // Restore Date objects
    return sessions.map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      messages: session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  } catch (error) {
    console.error('Error parsing chat sessions:', error);
    return [];
  }
};

// Helper to save sessions to local storage
const saveSessionsToStorage = (sessions: ChatSession[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving chat sessions:', error);
  }
};

// Create a new chat session
export const createChatSession = async (userId: string): Promise<string> => {
  try {
    const sessions = getSessionsFromStorage();
    const newSession: ChatSession = {
      id: uuidv4(),
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sessions.push(newSession);
    saveSessionsToStorage(sessions);
    return newSession.id;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

// Add a message to a chat session
export const addMessageToChat = async (
  chatId: string,
  message: Omit<Message, 'timestamp'>
): Promise<void> => {
  try {
    const sessions = getSessionsFromStorage();
    const sessionIndex = sessions.findIndex(s => s.id === chatId);

    if (sessionIndex === -1) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    const messageWithTimestamp: Message = {
      ...message,
      timestamp: new Date(),
    };

    sessions[sessionIndex].messages.push(messageWithTimestamp);
    sessions[sessionIndex].updatedAt = new Date();

    saveSessionsToStorage(sessions);
  } catch (error) {
    console.error('Error adding message to chat:', error);
    throw error;
  }
};

// Get messages for a chat session
export const getChatMessages = async (chatId: string): Promise<Message[]> => {
  try {
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.id === chatId);
    return session ? session.messages : [];
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
};

// Get all chat sessions for a user
export const getUserChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const sessions = getSessionsFromStorage();
    // In local storage mode, we might just return all sessions if we assume single user per browser,
    // but filtering by userId keeps the logic consistent with the interface.
    // If userId is not provided or we want to show all local chats, we could adjust.
    // For now, strict filtering:
    return sessions
      .filter(s => s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error('Error getting user chat sessions:', error);
    return [];
  }
};

// Simulate AI response
export const simulateAIResponse = async (userMessage: string): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simple response logic based on user input
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('new design') || lowerMessage.includes('start')) {
    return "Okay! Starting your new design... I'm here to help you create amazing floor plans and CAD projects. What type of space are you thinking about?";
  } else if (lowerMessage.includes('floor plan') || lowerMessage.includes('layout')) {
    return "Great! Let's work on your floor plan. What's the square footage and how many rooms do you need? I can help you optimize the layout for functionality and flow.";
  } else if (lowerMessage.includes('cad') || lowerMessage.includes('drawing')) {
    return "Perfect! CAD drawings are essential for precise architectural work. Are you working on residential, commercial, or industrial design? I can guide you through the technical specifications.";
  } else if (lowerMessage.includes('room') || lowerMessage.includes('bedroom') || lowerMessage.includes('kitchen')) {
    return "Excellent choice! Let's focus on that room. What are your priorities - functionality, aesthetics, or both? I can suggest optimal dimensions and layouts.";
  } else {
    return "I'm excited to help you with your architectural design! Whether it's floor plans, CAD drawings, or space planning, I'm here to guide you. What would you like to work on today?";
  }
};

// Guest mode localStorage functions 
// (These can now wrap the main functions or be aliases since everything is local)
export const getGuestChats = (): Message[] => {
  // Maintaining backward compatibility if used directly, 
  // but logically "guestChats" might ideally be just one of the sessions or a separate key.
  // The original implementation had a separate "guestChats" key.
  try {
    const chats = localStorage.getItem("guestChats");
    return chats ? JSON.parse(chats) : [];
  } catch (error) {
    console.error("Error getting guest chats:", error);
    return [];
  }
};

export const saveGuestChats = (messages: Message[]): void => {
  try {
    localStorage.setItem("guestChats", JSON.stringify(messages));
  } catch (error) {
    console.error("Error saving guest chats:", error);
  }
};

export const clearGuestChats = (): void => {
  localStorage.removeItem("guestChats");
};

