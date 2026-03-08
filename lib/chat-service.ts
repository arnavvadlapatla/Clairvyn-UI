import { v4 as uuidv4 } from 'uuid';
import { apiFetch } from "./backendApi";

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
    const restored = sessions.map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
      messages: session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
    console.debug('Loaded sessions from localStorage', restored);
    return restored;
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

// Create a new chat session, optionally specifying the ID (useful when syncing with backend)
export const createChatSession = async (
  userId: string,
  forcedId?: string
): Promise<string> => {
  try {
    const sessions = getSessionsFromStorage();
    const newSession: ChatSession = {
      id: forcedId || uuidv4(),
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

// Rename an existing local session (used when a backend chat ID is assigned)
export const renameChatSession = async (
  oldId: string,
  newId: string
): Promise<void> => {
  try {
    const sessions = getSessionsFromStorage();
    const idx = sessions.findIndex((s) => s.id === oldId);
    if (idx === -1) return;
    // avoid collision if newId already exists
    const exists = sessions.find((s) => s.id === newId);
    if (exists) {
      // merge messages if necessary
      sessions[idx].messages.forEach((m) => exists.messages.push(m));
      // remove old entry
      sessions.splice(idx, 1);
    } else {
      sessions[idx].id = newId;
    }
    saveSessionsToStorage(sessions);
  } catch (error) {
    console.error('Error renaming chat session:', error);
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
export const getChatMessages = async (chatId: string, token?: string): Promise<Message[]> => {
  console.debug('getChatMessages called', { chatId, token });
  // if an auth token is provided, attempt to fetch from the backend first
  if (token) {
    try {
      console.debug('fetching messages from backend', chatId);
      // new spec exposes /messages endpoint
      const data = await apiFetch<any>(
        `/api/chats/${encodeURIComponent(chatId)}/messages`,
        { method: "GET", token }
      );
      console.debug('raw history response', data);
      // normalize the array whether backend named it history or messages
      const array: any[] = Array.isArray(data?.history)
        ? data.history
        : Array.isArray(data?.messages)
        ? data.messages
        : [];
      // make sure timestamps are normalized
      const hist = array.map((m) => ({
        ...m,
        timestamp:
          typeof m.timestamp === "string"
            ? m.timestamp
            : (m.timestamp as Date).toISOString(),
      }));
      console.debug('received history from backend', hist);
      return hist;
    } catch (err) {
      console.warn("Unable to load messages from backend, falling back to local storage", err);
      // continue to local-storage fallback below
    }
  }

  try {
    const sessions = getSessionsFromStorage();
    const session = sessions.find((s) => s.id === chatId);
    console.debug('returning messages from local cache', session?.messages || []);
    return session ? session.messages : [];
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
};

// Get all chat sessions for a user
export const getUserChatSessions = async (
  userId: string,
  token?: string
): Promise<ChatSession[]> => {
  console.debug('getUserChatSessions', { userId, token });
  // if we have an auth token try to read sessions from the backend
  if (token) {
    try {
      // backend is expected to respond with an array of sessions that include at least
      // { id, user_id?, created_at, updated_at, messages? }
      const backendSessions: any[] = await apiFetch(`/api/chats`, {
        method: "GET",
        token,
      });
      console.log('raw sessions response from backend', backendSessions);
      // normalize the shape and sort by updatedAt
      const converted: ChatSession[] = backendSessions.map((s) => ({
        id: s.id,
        userId,
        messages: Array.isArray(s.messages)
          ? s.messages.map((m: any) => ({
              role: m.role,
              content: m.content,
              timestamp:
                typeof m.timestamp === "string"
                  ? m.timestamp
                  : (m.timestamp as Date).toISOString(),
            }))
          : [],
        createdAt: new Date(s.created_at || s.createdAt || Date.now()),
        updatedAt: new Date(s.updated_at || s.updatedAt || Date.now()),
      }));

      // store the backend sessions locally so we have an offline cache
      try {
        console.debug('caching backend sessions locally', converted);
        const all = getSessionsFromStorage().filter((s) => s.userId !== userId);
        const merged = all.concat(converted);
        saveSessionsToStorage(merged);
      } catch {
        /* ignore cache failure */
      }

      return converted.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (err) {
      console.warn("Unable to load sessions from backend, falling back to local storage", err);
      // fall through to the local-storage implementation below
    }
  }

  try {
    const sessions = getSessionsFromStorage();
    const filtered = sessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    console.debug('returning local user sessions', filtered);
    return filtered;
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

// Replace messages for a chat session (used after syncing with backend)
export const setChatMessages = async (
  chatId: string,
  messages: Message[]
): Promise<void> => {
  try {
    const sessions = getSessionsFromStorage();
    const sessionIndex = sessions.findIndex((s) => s.id === chatId);
    if (sessionIndex === -1) {
      // if the session doesn't exist locally, create it
      sessions.push({
        id: chatId,
        userId: '',
        messages,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      sessions[sessionIndex].messages = messages;
      sessions[sessionIndex].updatedAt = new Date();
    }
    saveSessionsToStorage(sessions);
  } catch (error) {
    console.error('Error setting chat messages:', error);
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

