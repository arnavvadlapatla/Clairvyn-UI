"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Mock User interface to replace Firebase User
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  migrateGuestChats: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check for stored user and guest mode on mount
    const storedUser = localStorage.getItem('clairvyn_user');
    const guestMode = localStorage.getItem("guest") === "true";

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('clairvyn_user');
      }
    }

    setIsGuest(guestMode);
    setLoading(false);
  }, []);

  const enterGuestMode = () => {
    localStorage.setItem("guest", "true");
    setIsGuest(true);
  };

  const exitGuestMode = () => {
    localStorage.removeItem("guest");
    localStorage.removeItem("guestChats");
    setIsGuest(false);
  };

  const migrateGuestChats = async () => {
    // In this local-storage migration, we might just rename keys or merge arrays
    // For now, since everything is local storage, "guest chats" are just chats without a User ID potentially?
    // Or we keep them separate. Code below just acknowledges the function exists.
    console.log("Migrating guest chats (mock implementation)");
    localStorage.removeItem("guestChats"); // Clear legacy guest chats after "migration"
    localStorage.removeItem("guest");
    setIsGuest(false);
  };

  const signIn = async (email: string, password: string) => {
    // Mock sigh in
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const mockUser: User = {
      uid: uuidv4(),
      email,
      displayName: email.split('@')[0],
      photoURL: null
    };
    setUser(mockUser);
    localStorage.setItem('clairvyn_user', JSON.stringify(mockUser));
    await migrateGuestChats();
  };

  const signUp = async (email: string, password: string) => {
    // Mock sign up - same as sign in for this demo
    await signIn(email, password);
  };

  const signInWithGoogle = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockUser: User = {
      uid: uuidv4(),
      email: 'user@gmail.com',
      displayName: 'Google User',
      photoURL: null
    };
    setUser(mockUser);
    localStorage.setItem('clairvyn_user', JSON.stringify(mockUser));
    await migrateGuestChats();
  };

  const signInWithGithub = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const mockUser: User = {
      uid: uuidv4(),
      email: 'user@github.com',
      displayName: 'GitHub User',
      photoURL: null
    };
    setUser(mockUser);
    localStorage.setItem('clairvyn_user', JSON.stringify(mockUser));
    await migrateGuestChats();
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('clairvyn_user');
    if (isGuest) {
      exitGuestMode();
    }
  };

  const value = {
    user,
    loading,
    isGuest,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    logout,
    enterGuestMode,
    exitGuestMode,
    migrateGuestChats,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

