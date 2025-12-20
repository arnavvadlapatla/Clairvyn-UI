"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Star,
  Clock,
  Target,
  RotateCcw,
  FileText,
  ArrowRight,
  Share2,
  Zap,
  Award,
  TrendingUp,
  ArrowLeft,
  Twitter,
  Linkedin,
  Copy,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { EnarcLogoSmall } from "@/components/enarc-logo"

interface ChallengeIssue {
  id: number
  area: string
  problem: string
  isFixed: boolean
  hint?: string
  severity: "critical" | "high" | "medium"
}

interface FeedbackData {
  challengeTitle: string
  overallSuccess: boolean
  issuesFixed: number
  totalIssues: number
  timeSpent: number // in seconds
  pointsEarned: number
  xpGained: number
  badgeUnlocked?: {
    name: string
    icon: string
    description: string
  }
  issues: ChallengeIssue[]
  performanceLevel: "Excellent" | "Good" | "Needs Improvement"
  accuracy: number // percentage
}

export default function FeedbackPage() {
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)
  const router = useRouter()

  // Mock feedback data
  const mockFeedbackData: FeedbackData = {
    challengeTitle: "Residential Layout Optimization",
    overallSuccess: true,
    issuesFixed: 4,
    totalIssues: 5,
    timeSpent: 847, // 14 minutes 7 seconds
    pointsEarned: 180,
    xpGained: 250,
    badgeUnlocked: {
      name: "Problem Solver",
      icon: "🧩",
      description: "Fixed 4+ issues in a single challenge",
    },
    issues: [
      {
        id: 1,
        area: "Kitchen",
        problem: "lacks ventilation",
        isFixed: true,
        severity: "high",
      },
      {
        id: 2,
        area: "Bedroom 2",
        problem: "no emergency exit",
        isFixed: false,
        hint: "Add a secondary window or door that meets egress requirements for bedrooms",
        severity: "critical",
      },
      {
        id: 3,
        area: "Hallway",
        problem: "too narrow",
        isFixed: true,
        severity: "medium",
      },
      {
        id: 4,
        area: "Living Room",
        problem: "poor natural lighting",
        isFixed: true,
        severity: "medium",
      },
      {
        id: 5,
        area: "Bathroom Door",
        problem: "opens into kitchen",
        isFixed: true,
        severity: "high",
      },
    ],
    performanceLevel: "Good",
    accuracy: 80,
  }

  useEffect(() => {
    loadFeedbackData()
  }, [])

  const loadFeedbackData = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setFeedbackData(mockFeedbackData)
    setIsLoading(false)

    // Show celebration if badge unlocked
    if (mockFeedbackData.badgeUnlocked) {
      setTimeout(() => setShowCelebration(true), 500)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200"
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case "Excellent":
        return "text-green-600 bg-green-50 border-green-200"
      case "Good":
        return "text-blue-600 bg-blue-50 border-blue-200"
      case "Needs Improvement":
        return "text-orange-600 bg-orange-50 border-orange-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const handleShare = (platform: string) => {
    const text = `Just completed the ${feedbackData?.challengeTitle} challenge on ENARC! 🏗️ Fixed ${feedbackData?.issuesFixed}/${feedbackData?.totalIssues} issues and earned ${feedbackData?.pointsEarned} points! #Architecture #ENARC #Challenge`
    const url = window.location.origin

    switch (platform) {
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)
        break
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)
        break
      case "copy":
        navigator.clipboard.writeText(`${text} ${url}`)
        break
    }
    setShowShareDialog(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Card className="max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <motion.div
              className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
            <p className="text-gray-600 font-medium">Analyzing your solution...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!feedbackData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Card className="max-w-md shadow-2xl">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 font-medium">No feedback data available</p>
            <Link href="/challenge">
              <Button className="mt-4 btn-gradient text-white">Start New Challenge</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 blueprint-bg" />
      </div>

      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && feedbackData.badgeUnlocked && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-md mx-4"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                {feedbackData.badgeUnlocked.icon}
              </motion.div>
              <h3 className="text-2xl font-bold text-charcoal mb-2">Badge Unlocked!</h3>
              <h4 className="text-xl font-semibold text-teal-600 mb-2">{feedbackData.badgeUnlocked.name}</h4>
              <p className="text-gray-600 mb-6">{feedbackData.badgeUnlocked.description}</p>
              <Button onClick={() => setShowCelebration(false)} className="btn-gradient text-white">
                Awesome!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-300 bg-white/80 backdrop-blur-sm hover:bg-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <EnarcLogoSmall size={32} />
              <div>
                <h1 className="text-3xl font-black text-charcoal">Challenge Complete!</h1>
                <p className="text-gray-600 font-medium">{feedbackData.challengeTitle}</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowShareDialog(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg hover:shadow-xl"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Achievement
          </Button>
        </motion.div>

        {/* Performance Summary */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-xl overflow-hidden">
            <div
              className={`h-2 ${
                feedbackData.overallSuccess
                  ? "bg-gradient-to-r from-green-400 to-green-500"
                  : "bg-gradient-to-r from-red-400 to-red-500"
              }`}
            />
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <motion.div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    feedbackData.overallSuccess
                      ? "bg-gradient-to-r from-green-400 to-green-500"
                      : "bg-gradient-to-r from-red-400 to-red-500"
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.4 }}
                >
                  {feedbackData.overallSuccess ? (
                    <CheckCircle className="w-10 h-10 text-white" />
                  ) : (
                    <XCircle className="w-10 h-10 text-white" />
                  )}
                </motion.div>
                <h2 className="text-3xl font-black text-charcoal mb-2">
                  {feedbackData.overallSuccess ? "Challenge Passed!" : "Challenge Failed"}
                </h2>
                <p className="text-lg text-gray-600">
                  You fixed {feedbackData.issuesFixed} out of {feedbackData.totalIssues} issues
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <Target className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{feedbackData.accuracy}%</div>
                    <div className="text-sm text-gray-600">Accuracy</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{formatTime(feedbackData.timeSpent)}</div>
                    <div className="text-sm text-gray-600">Time Spent</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{feedbackData.pointsEarned}</div>
                    <div className="text-sm text-gray-600">Points Earned</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{feedbackData.xpGained}</div>
                    <div className="text-sm text-gray-600">XP Gained</div>
                  </div>
                </div>
              </div>

              {/* Performance Level */}
              <div className="mt-6 text-center">
                <Badge className={`${getPerformanceColor(feedbackData.performanceLevel)} font-bold text-lg px-4 py-2`}>
                  Performance: {feedbackData.performanceLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Badge Unlock */}
        {feedbackData.badgeUnlocked && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="bg-gradient-to-r from-yellow-400 to-orange-500 border-0 shadow-xl">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-4xl">{feedbackData.badgeUnlocked.icon}</div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-white">Badge Unlocked!</h3>
                    <p className="text-yellow-100 font-semibold">{feedbackData.badgeUnlocked.name}</p>
                    <p className="text-yellow-100 text-sm">{feedbackData.badgeUnlocked.description}</p>
                  </div>
                  <Award className="w-8 h-8 text-white" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Detailed Feedback */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl text-charcoal flex items-center gap-2">
                <FileText className="w-6 h-6 text-teal-600" />
                Detailed Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feedbackData.issues.map((issue, index) => (
                  <motion.div
                    key={issue.id}
                    className={`border rounded-xl p-4 ${
                      issue.isFixed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {issue.isFixed ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-charcoal">
                            {issue.area}: {issue.problem}
                          </h4>
                          <Badge className={`${getSeverityColor(issue.severity)} text-xs`}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className={`text-sm ${issue.isFixed ? "text-green-700" : "text-red-700"}`}>
                          {issue.isFixed ? "✅ Correctly fixed" : "❌ Needs attention"}
                        </p>
                        {!issue.isFixed && issue.hint && (
                          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-yellow-800">
                                <strong>Hint:</strong> {issue.hint}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="grid md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Button
            variant="outline"
            size="lg"
            className="h-16 border-2 border-gray-300 hover:bg-gray-50 bg-white/80 backdrop-blur-sm"
            onClick={() => router.push("/challenge")}
          >
            <RotateCcw className="w-6 h-6 mr-3" />
            <div className="text-left">
              <div className="font-bold">Retry Challenge</div>
              <div className="text-sm text-gray-600">Try again to improve</div>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-16 border-2 border-teal-300 text-teal-600 hover:bg-teal-50 bg-white/80 backdrop-blur-sm"
            onClick={() => router.push("/solution")}
          >
            <FileText className="w-6 h-6 mr-3" />
            <div className="text-left">
              <div className="font-bold">View Solution</div>
              <div className="text-sm text-teal-600">See the ideal fix</div>
            </div>
          </Button>

          <Button
            size="lg"
            className="h-16 btn-gradient text-white shadow-lg hover:shadow-xl"
            onClick={() => router.push("/challenge")}
          >
            <ArrowRight className="w-6 h-6 mr-3" />
            <div className="text-left">
              <div className="font-bold">Next Challenge</div>
              <div className="text-sm text-teal-100">Continue learning</div>
            </div>
          </Button>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg max-w-md mx-auto">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-charcoal">Your Progress</span>
              </div>
              <Progress value={feedbackData.accuracy} className="h-3 mb-2" />
              <p className="text-sm text-gray-600">Keep practicing to reach 100% accuracy and unlock more badges!</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-charcoal">Share Your Achievement</DialogTitle>
            <DialogDescription>Let others know about your architectural problem-solving skills!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Just completed the {feedbackData.challengeTitle} challenge on ENARC! 🏗️ Fixed {feedbackData.issuesFixed}/
                {feedbackData.totalIssues} issues and earned {feedbackData.pointsEarned} points!
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                onClick={() => handleShare("twitter")}
                className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Twitter className="w-4 h-4" />
                Twitter
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare("linkedin")}
                className="flex items-center gap-2 border-blue-700 text-blue-700 hover:bg-blue-50"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </Button>
              <Button
                variant="outline"
                onClick={() => handleShare("copy")}
                className="flex items-center gap-2 border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
