"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Camera, LogOut } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getBackendUrl } from "@/lib/backendApi"

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout: () => void
  profileImageUrl: string | null
}

interface UserProfile {
  displayName: string
  photoURL: string | null
  email?: string
  university?: string
  location?: string
}

export function UserProfileModal({ isOpen, onClose, onLogout, profileImageUrl }: UserProfileModalProps) {
  const { user, getIdToken } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // localStorage helpers — keyed by uid so multiple accounts on same device don't bleed
  const lsGet = (key: string) => {
    if (typeof window === "undefined" || !user?.uid) return ""
    try { return localStorage.getItem(`clairvyn_profile_${user.uid}_${key}`) ?? "" } catch { return "" }
  }
  const lsSet = (key: string, value: string) => {
    if (typeof window === "undefined" || !user?.uid) return
    try { localStorage.setItem(`clairvyn_profile_${user.uid}_${key}`, value) } catch { /* ignore */ }
  }

  const [formData, setFormData] = useState<UserProfile>({
    displayName: user?.displayName || "",
    photoURL: user?.photoURL || profileImageUrl,
    email: user?.email || "",
    university: "",
    location: "",
  })

  // Seed basic fields from Firebase user object
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        displayName: user.displayName || prev.displayName,
        photoURL: user.photoURL || profileImageUrl || prev.photoURL,
        email: user.email || prev.email,
      }))
    }
  }, [user, profileImageUrl])

  // Fetch university + location from backend whenever the modal opens;
  // fall back to localStorage so data survives even if backend doesn't persist it.
  useEffect(() => {
    if (!isOpen || !user) return
    // Apply localStorage values immediately (instant, no flash)
    setFormData((prev) => ({
      ...prev,
      university: prev.university || lsGet("university"),
      location: prev.location || lsGet("location"),
      photoURL: prev.photoURL || lsGet("photo") || null,
    }))
    let cancelled = false
    getIdToken().then((token) => {
      if (!token || cancelled) return
      fetch(getBackendUrl("/api/me"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data) return
          const profile = data.profile ?? data
          const uni = profile.university ?? profile.institution ?? ""
          const loc = profile.location ?? profile.city ?? ""
          const photo = profile.photo_url ?? profile.photoURL ?? ""
          setFormData((prev) => ({
            ...prev,
            university: uni || prev.university,
            location: loc || prev.location,
            photoURL: photo || prev.photoURL,
          }))
          // Keep localStorage in sync with what the server returned
          if (uni)    lsSet("university", uni)
          if (loc)    lsSet("location", loc)
          if (photo)  lsSet("photo", photo)
        })
        .catch(() => {})
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.uid])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB")
      setTimeout(() => setError(""), 3000)
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, GIF)")
      setTimeout(() => setError(""), 3000)
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string

          // Optimistic update — show preview immediately
          setFormData((prev) => ({ ...prev, photoURL: base64String }))
          lsSet("photo", base64String)

          const token = await getIdToken()
          
          if (!token) {
            setError("Authentication failed. Please sign in again.")
            setIsLoading(false)
            return
          }

          // Upload to backend
          const response = await fetch(getBackendUrl("/api/me/profile-photo"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              photoData: base64String,
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to upload photo")
          }

          setSuccess("Photo updated!")
          setTimeout(() => setSuccess(""), 2000)
        } catch (err) {
          setError("Photo saved locally but couldn't sync to server.")
          setTimeout(() => setError(""), 3000)
        } finally {
          setIsLoading(false)
        }
      }

      reader.readAsDataURL(file)
    } catch (err) {
      setError("Error reading file")
      setTimeout(() => setError(""), 3000)
      setIsLoading(false)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSaveProfile = async () => {
    if (!formData.displayName.trim()) {
      setError("Name is required")
      setTimeout(() => setError(""), 3000)
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const token = await getIdToken()
      if (!token) {
        setError("Authentication failed. Please sign in again.")
        setIsLoading(false)
        return
      }

      // Update backend
      const response = await fetch(getBackendUrl("/api/me/profile"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: formData.displayName,
          university: formData.university,
          location: formData.location,
        }),
      })

      // Persist to localStorage regardless of whether the backend saves university/location,
      // so the fields survive a page reload even if the backend hasn't implemented them yet.
      lsSet("university", formData.university ?? "")
      lsSet("location", formData.location ?? "")

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      // Update Firebase displayName
      if (user && formData.displayName !== user.displayName) {
        const { updateProfile } = await import("firebase/auth")
        await updateProfile(user, { displayName: formData.displayName })
      }

      setSuccess("Profile saved!")
      setTimeout(() => {
        setSuccess("")
        onClose()
      }, 1500)
    } catch (err) {
      setError("Failed to save profile")
      setTimeout(() => setError(""), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoutClick = async () => {
    setIsLoading(true)
    try {
      await onLogout()
      onClose()
    } catch (err) {
      setError("Failed to sign out")
      setTimeout(() => setError(""), 3000)
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.65)] backdrop-blur-sm overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.2 }}
          />

          {/* Modal Container - bottom sheet on mobile, centered dialog on sm+ */}
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-4">
            {/* Modal */}
            <motion.div
              className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#FAF8F5] dark:bg-[#242320] shadow-2xl dark:shadow-[0_8px_40px_rgba(0,0,0,0.50)] flex flex-col max-h-[92vh] sm:max-h-[90vh] pointer-events-auto"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
              style={{ willChange: "transform" }}
            >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
            </div>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#FAF8F5] dark:bg-[#242320] border-b border-gray-200 dark:border-[rgba(255,255,255,0.07)] px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#F0EBE0]">Profile</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-[#2A2825] transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-[#6B6458] dark:hover:text-[#F0EBE0] transition-colors" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="profile-modal-content overflow-y-auto flex-1 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-5">
              {/* Error Message */}
              {error && (
                <motion.div
                  className="p-3 rounded-xl bg-red-50 dark:bg-[#2A1E1E] border border-red-200 dark:border-[#DC2626]/50"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <p className="text-sm text-red-700 dark:text-[#DC2626] font-medium">{error}</p>
                </motion.div>
              )}

              {/* Success Message */}
              {success && (
                <motion.div
                  className="p-3 rounded-xl bg-gray-100 dark:bg-[#2C2A27] border border-gray-300 dark:border-[rgba(255,255,255,0.07)]"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <p className="text-sm text-gray-700 dark:text-[#A8A090] font-medium">{success}</p>
                </motion.div>
              )}

              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-4">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <Avatar className="w-24 h-24 border-2 border-gray-200 dark:border-[rgba(155,127,212,0.40)] ring-2 ring-offset-2 ring-transparent dark:ring-transparent">
                    {(formData.photoURL || profileImageUrl) && (
                      <AvatarImage
                        src={formData.photoURL || profileImageUrl || ""}
                        alt={formData.displayName}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback
                      className="dark:text-[#C4B0F0]"
                      style={{ background: '#2C2A27', fontSize: '20px', fontWeight: 500 }}
                    >
                      {formData.displayName
                        ? formData.displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                        : "?"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Hover overlay with camera icon */}
                  <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-200">
                    <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-[#6B6458] text-center">Click to change photo</p>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[#F0EBE0] mb-2">
                  Full Name
                </label>
                {user?.displayName ? (
                  <div className="w-full px-4 py-2.5 rounded-[10px] bg-gray-100 dark:bg-[#2C2A27] border border-gray-300 dark:border-[rgba(255,255,255,0.09)] text-gray-500 dark:text-[#A8A090] text-sm font-medium">
                    {user.displayName}
                  </div>
                ) : (
                  <Input
                    name="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    placeholder="Your name"
                    className="w-full bg-gray-50 dark:bg-[#2C2A27] border-gray-300 dark:border-[rgba(255,255,255,0.09)] dark:focus:border-[rgba(155,127,212,0.45)] text-gray-900 dark:text-[#F0EBE0] rounded-[10px] py-2.5"
                  />
                )}
              </div>

              {/* University Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[#F0EBE0] mb-2">
                  University / Institution
                </label>
                <Input
                  name="university"
                  type="text"
                  value={formData.university}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  placeholder="e.g., Stanford University"
                  className="w-full bg-gray-50 dark:bg-[#2C2A27] border-gray-300 dark:border-[rgba(255,255,255,0.09)] dark:focus:border-[rgba(155,127,212,0.45)] text-gray-900 dark:text-[#F0EBE0] rounded-[10px] py-2.5"
                />
              </div>

              {/* Location Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-[#F0EBE0] mb-2">
                  Location
                </label>
                <Input
                  name="location"
                  type="text"
                  value={formData.location}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  placeholder="e.g., San Francisco, CA, USA"
                  className="w-full bg-gray-50 dark:bg-[#2C2A27] border-gray-300 dark:border-[rgba(255,255,255,0.09)] dark:focus:border-[rgba(155,127,212,0.45)] text-gray-900 dark:text-[#F0EBE0] rounded-[10px] py-2.5"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-[rgba(255,255,255,0.07)]" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {/* Save — full width on mobile, 1/3 on sm+ */}
                <motion.button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="w-full sm:hidden bg-[#7C5CBF] hover:bg-[#5A3A9E] dark:bg-transparent dark:text-[#C4B0F0] dark:hover:text-[#F0EBE0] dark:border dark:border-[rgba(155,127,212,0.25)] text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors text-sm"
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? "Saving..." : "Save"}
                </motion.button>
                {/* Cancel + Sign Out row on mobile; all three on sm+ */}
                <div className="flex gap-3">
                  <motion.button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 dark:text-[#A8A090] hover:text-gray-700 dark:hover:text-[#F0EBE0] transition-colors text-center"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleLogoutClick}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-red-300 dark:border-[#DC2626]/40 text-red-600 dark:text-[#DC2626] hover:bg-red-50 dark:hover:bg-[#DC2626]/10 font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </motion.button>
                  <motion.button
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="hidden sm:block flex-1 bg-[#7C5CBF] hover:bg-[#5A3A9E] dark:bg-transparent dark:text-[#C4B0F0] dark:hover:text-[#F0EBE0] dark:border dark:border-[rgba(155,127,212,0.25)] text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-colors text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? "Saving..." : "Save"}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
