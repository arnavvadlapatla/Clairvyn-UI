"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  User as FirebaseUser,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

interface AuthContextType {
  user: FirebaseUser | null
  loading: boolean
  isGuest: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  // Social providers can be wired later if needed; keep the surface for now.
  signInWithGoogle: () => Promise<void>
  signInWithGithub: () => Promise<void>
  logout: () => Promise<void>
  enterGuestMode: () => void
  exitGuestMode: () => void
  migrateGuestChats: () => Promise<void>
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    const guestMode = typeof window !== "undefined" && localStorage.getItem("guest") === "true"
    setIsGuest(guestMode)

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const enterGuestMode = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("guest", "true")
    }
    setIsGuest(true)
  }

  const exitGuestMode = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("guest")
      localStorage.removeItem("guestChats")
    }
    setIsGuest(false)
  }

  const migrateGuestChats = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("guestChats")
      localStorage.removeItem("guest")
    }
    setIsGuest(false)
  }

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
    await migrateGuestChats()
  }

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
    await migrateGuestChats()
    console.log("Signed up with email:", email)
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    await migrateGuestChats()
    console.log("Signed in with Google")
  }

  const signInWithGithub = async () => {
    const provider = new GithubAuthProvider()
    await signInWithPopup(auth, provider)
    await migrateGuestChats()
    console.log("Signed in with GitHub")
  }

  const logout = async () => {
    await signOut(auth)
    if (isGuest) {
      exitGuestMode()
    }
  }

  const getIdToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      if (!auth.currentUser) return null
      try {
        return await auth.currentUser.getIdToken(forceRefresh)
      } catch (e) {
        console.error("Failed to get ID token", e)
        return null
      }
    },
    []
  )

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
    getIdToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}