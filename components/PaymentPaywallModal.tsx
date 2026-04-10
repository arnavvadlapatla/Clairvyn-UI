"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles, Zap, Crown, X, Check } from "lucide-react"
import { getBackendUrl } from "@/lib/backendApi"

const PAYWALL_PRICE_INR = 299
const FREE_GENERATIONS = 6

const features = [
  "Unlimited floor plan generations",
  "Multi-step design refinement",
  "DXF & PNG downloads",
  "Priority AI processing",
]

type PaymentPaywallModalProps = {
  open: boolean
  onClose: () => void
  hasUser: boolean
  getToken: () => Promise<string | null>
  onSignInClick: () => void
}

export function PaymentPaywallModal({
  open,
  onClose,
  hasUser,
  getToken,
  onSignInClick,
}: PaymentPaywallModalProps) {
  const [payLoading, setPayLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayWithPhonePe = async () => {
    if (!hasUser) {
      onSignInClick()
      return
    }
    setError(null)
    setPayLoading(true)
    try {
      const token = await getToken()
      if (!token) {
        setError("Please sign in to pay.")
        setPayLoading(false)
        return
      }
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const merchantOrderId = `clv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const redirectUrl = `${origin}/chatbot?payment_return=1&order_id=${encodeURIComponent(merchantOrderId)}`

      const res = await fetch(getBackendUrl("/api/payments/phonepe/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_in_inr: PAYWALL_PRICE_INR,
          order_id: merchantOrderId,
          redirect_url: redirectUrl,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Failed to start payment")
        setPayLoading(false)
        return
      }
      const redirectTo = data?.redirect_url
      if (redirectTo) {
        window.location.href = redirectTo
        return
      }
      setError("No payment link received")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setPayLoading(false)
    }
  }

  const handleMaybeLater = () => {
    setError(null)
    onClose()
  }

  const shellGradient =
    "bg-gradient-to-br from-[#F8F5FF] via-[#F8F5FF] to-[#EDE8FA] border border-[#D4C8F0] shadow-[0_24px_64px_rgba(124,92,191,0.20)]"
  const glowTop =
    "bg-[radial-gradient(ellipse_at_top_left,rgba(155,127,212,0.18),transparent_62%)]"
  const glowBottom =
    "bg-[radial-gradient(ellipse_at_bottom_right,rgba(124,92,191,0.12),transparent_62%)]"
  const textPrimary = "text-[#1A1040]"
  const textMuted = "text-[#5B4D8A]"
  const badgeStyle =
    "bg-white/70 border-[#D4C8F0] text-[#1A1040]"
  const cardStyle =
    "rounded-2xl bg-white/78 backdrop-blur-sm border border-[#D4C8F0] p-4 mb-5"
  const progressTrack = "bg-[#EDE8FA]"
  const progressFill = "bg-gradient-to-r from-[#7C5CBF] to-[#9B7FD4]"
  const primaryBtn =
    "w-full h-12 rounded-xl text-base font-semibold bg-[#7C5CBF] text-white hover:bg-[#5A3A9E] border-0 shadow-lg shadow-[rgba(124,92,191,0.30)] transition-all hover:-translate-y-0.5"
  const secondaryBtn = "text-[#5B4D8A]/45 hover:text-[#5B4D8A]/75"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleMaybeLater()}>
      <DialogContent
        className="p-0 border-0 bg-transparent shadow-none max-w-[440px] overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          className={`relative rounded-3xl overflow-hidden ${shellGradient}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
          <div className={`absolute inset-0 ${glowTop}`} />
          <div className={`absolute inset-0 ${glowBottom}`} />

          <div className="relative z-10 px-7 pt-7 pb-6">
            <button
              onClick={handleMaybeLater}
              className="absolute top-4 right-4 p-1.5 rounded-full transition-colors bg-[#EDE8FA] hover:bg-[#D4C8F0] text-[#7C5CBF] hover:text-[#5A3A9E]"
            >
              <X className="w-4 h-4" />
            </button>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`inline-flex items-center gap-1.5 rounded-full backdrop-blur-sm border px-3 py-1 mb-5 ${badgeStyle}`}
            >
              <Crown className="w-3.5 h-3.5 text-[#7C5CBF]" />
              <span className="text-xs font-semibold tracking-wide">PREMIUM</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`text-2xl font-bold leading-tight ${textPrimary}`}
            >
              You&apos;ve used all {FREE_GENERATIONS} free
              <br />
              generations
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm ${textMuted}`}
            >
              Upgrade to keep designing unlimited floor plans with Clairvyn AI.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 mb-5"
            >
              <div className={`flex items-center justify-between text-xs mb-1.5 ${textMuted}`}>
                <span>Generations used</span>
                <span className="font-medium text-[#7C5CBF]">{FREE_GENERATIONS}/{FREE_GENERATIONS}</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${progressTrack}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full ${progressFill}`}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cardStyle}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-[#5B4D8A]/60">What you get</p>
              <ul className="space-y-2.5">
                {features.map((feature, i) => (
                  <motion.li
                    key={feature}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.06 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-[#EDE8FA]">
                      <Check className="w-3 h-3 text-[#7C5CBF]" />
                    </div>
                    <span className="text-sm text-[#1A1040]/85">{feature}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-baseline gap-1 mb-4"
            >
              <span className="text-lg font-bold text-[#7C5CBF]">₹</span>
              <span className={`text-4xl font-extrabold ${textPrimary}`}>{PAYWALL_PRICE_INR.toLocaleString("en-IN")}</span>
              <span className="text-sm ml-1 text-[#5B4D8A]/55">one-time</span>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-rose-200 bg-rose-500/20 border border-rose-400/30 rounded-xl px-3 py-2 mb-3"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col gap-2.5"
            >
              <Button
                onClick={handlePayWithPhonePe}
                disabled={payLoading}
                className={primaryBtn}
              >
                {payLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : hasUser ? (
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Pay with PhonePe
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Sign in to upgrade
                  </span>
                )}
              </Button>

              <button
                onClick={handleMaybeLater}
                className={`w-full py-2.5 text-sm font-medium transition-colors ${secondaryBtn}`}
              >
                Maybe later
              </button>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
