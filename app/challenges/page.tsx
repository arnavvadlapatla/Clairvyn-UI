"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Lock,
  Star,
  ArrowLeft,
  Play,
  CheckCircle,
  Zap,
  Trophy,
  Target,
  Clock,
  Users,
  TrendingUp,
  Award,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { EnarcLogoSmall } from "@/components/enarc-logo"

interface ChallengeLevel {
  id: number
  title: string
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Master Architect"
  description: string
  isUnlocked: boolean
  isCompleted: boolean
  starsEarned: number
  maxStars: number
  xpReward: number
  estimatedTime: string
  participantCount: number
  completionRate: number
  icon: string
  color: {
    primary: string
    secondary: string
    accent: string
  }
}

export default function ChallengeSelectionPage() {
  const [challenges, setChallenges] = useState<ChallengeLevel[]>([])
  const [userProgress, setUserProgress] = useState({ level: 1, totalXP: 0, totalStars: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Mock challenge data with progressive difficulty
  const mockChallenges: ChallengeLevel[] = [
    {
      id: 1,
      title: "Efficient Studio Layout",
      difficulty: "Beginner",
      description:
        "Learn the basics of space optimization in a compact studio apartment. Fix furniture placement and improve workflow.",
      isUnlocked: true,
      isCompleted: true,
      starsEarned: 3,
      maxStars: 3,
      xpReward: 100,
      estimatedTime: "10-15 min",
      participantCount: 2847,
      completionRate: 89,
      icon: "🏠",
      color: {
        primary: "from-green-400 to-green-500",
        secondary: "bg-green-50 border-green-200",
        accent: "text-green-600",
      },
    },
    {
      id: 2,
      title: "2BHK Ventilation Fix",
      difficulty: "Intermediate",
      description: "Master ventilation principles and natural lighting. Solve airflow issues in a residential layout.",
      isUnlocked: true,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 200,
      estimatedTime: "15-20 min",
      participantCount: 1923,
      completionRate: 76,
      icon: "🌬️",
      color: {
        primary: "from-blue-400 to-blue-500",
        secondary: "bg-blue-50 border-blue-200",
        accent: "text-blue-600",
      },
    },
    {
      id: 3,
      title: "Accessibility Upgrade",
      difficulty: "Advanced",
      description: "Apply universal design principles. Ensure ADA compliance and create barrier-free environments.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 350,
      estimatedTime: "20-25 min",
      participantCount: 1456,
      completionRate: 64,
      icon: "♿",
      color: {
        primary: "from-purple-400 to-purple-500",
        secondary: "bg-purple-50 border-purple-200",
        accent: "text-purple-600",
      },
    },
    {
      id: 4,
      title: "Duplex Optimization",
      difficulty: "Expert",
      description: "Handle complex multi-level design challenges. Optimize vertical circulation and space efficiency.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 500,
      estimatedTime: "25-30 min",
      participantCount: 892,
      completionRate: 52,
      icon: "🏢",
      color: {
        primary: "from-orange-400 to-orange-500",
        secondary: "bg-orange-50 border-orange-200",
        accent: "text-orange-600",
      },
    },
    {
      id: 5,
      title: "Skyscraper Lobby Design",
      difficulty: "Master Architect",
      description:
        "Master commercial space design. Create impressive, functional lobbies with complex circulation patterns.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 750,
      estimatedTime: "30-40 min",
      participantCount: 234,
      completionRate: 31,
      icon: "🏗️",
      color: {
        primary: "from-red-400 to-red-500",
        secondary: "bg-red-50 border-red-200",
        accent: "text-red-600",
      },
    },
  ]

  useEffect(() => {
    loadChallenges()
  }, [])

  const loadChallenges = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800))
    setChallenges(mockChallenges)

    // Calculate user progress
    const totalStars = mockChallenges.reduce((sum, challenge) => sum + challenge.starsEarned, 0)
    const totalXP = mockChallenges
      .filter((challenge) => challenge.isCompleted)
      .reduce((sum, challenge) => sum + challenge.xpReward, 0)

    setUserProgress({ level: 1, totalXP, totalStars })
    setIsLoading(false)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner":
        return "bg-green-100 text-green-700 border-green-300"
      case "Intermediate":
        return "bg-blue-100 text-blue-700 border-blue-300"
      case "Advanced":
        return "bg-purple-100 text-purple-700 border-purple-300"
      case "Expert":
        return "bg-orange-100 text-orange-700 border-orange-300"
      case "Master Architect":
        return "bg-gradient-to-r from-red-400 to-red-500 text-white border-red-400"
      default:
        return "bg-gray-100 text-gray-700 border-gray-300"
    }
  }

  const handleChallengeClick = (challenge: ChallengeLevel) => {
    if (!challenge.isUnlocked) {
      return // Tooltip will show the lock message
    }

    // Store selected challenge and navigate
    localStorage.setItem("selectedChallenge", JSON.stringify(challenge))
    router.push("/challenge")
  }

  const renderStars = (earned: number, max: number) => {
    return (
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <Star key={i} className={`w-4 h-4 ${i < earned ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
        ))}
      </div>
    )
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
            <p className="text-gray-600 font-medium">Loading ENARC challenges...</p>
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
        <div className="absolute inset-0 geometric-overlay" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center justify-between mb-8">
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
              <span className="text-lg font-bold text-charcoal">ENARC Challenges</span>
            </div>
            <div className="w-20" /> {/* Spacer for centering */}
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-charcoal mb-4">Select Your Challenge</h1>
          <p className="text-xl text-gray-600 font-medium max-w-2xl mx-auto">
            Sharpen your spatial design skills step by step through progressive architectural challenges
          </p>
        </motion.div>

        {/* User Progress Summary */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-xl max-w-4xl mx-auto">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <Trophy className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{userProgress.totalStars}</div>
                    <div className="text-sm text-gray-600">Stars Earned</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                    <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{userProgress.totalXP}</div>
                    <div className="text-sm text-gray-600">Total XP</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">
                      {challenges.filter((c) => c.isCompleted).length}/{challenges.length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <Award className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-charcoal">{userProgress.level}</div>
                    <div className="text-sm text-gray-600">Current Level</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Challenge Cards */}
        <div className="max-w-6xl mx-auto">
          {/* Desktop: Horizontal Layout */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-5 gap-6">
              {challenges.map((challenge, index) => (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                  className="relative"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card
                          className={`relative overflow-hidden border-2 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group ${
                            challenge.isUnlocked
                              ? "hover:scale-105 border-gray-200 hover:border-teal-300"
                              : "border-gray-300 opacity-60 cursor-not-allowed"
                          } ${challenge.isCompleted ? "ring-2 ring-green-400" : ""}`}
                          onClick={() => handleChallengeClick(challenge)}
                        >
                          {/* Gradient Header */}
                          <div className={`h-3 bg-gradient-to-r ${challenge.color.primary}`} />

                          {/* Lock Overlay */}
                          {!challenge.isUnlocked && (
                            <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-10">
                              <div className="bg-white rounded-full p-3 shadow-lg">
                                <Lock className="w-6 h-6 text-gray-600" />
                              </div>
                            </div>
                          )}

                          {/* Completion Badge */}
                          {challenge.isCompleted && (
                            <div className="absolute top-4 right-4 z-20">
                              <div className="bg-green-500 rounded-full p-1 shadow-lg">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}

                          <CardContent className="p-6">
                            {/* Level Number & Icon */}
                            <div className="text-center mb-4">
                              <div className="text-4xl mb-2">{challenge.icon}</div>
                              <div className="text-3xl font-black text-charcoal mb-1">Level {challenge.id}</div>
                              <Badge className={`${getDifficultyColor(challenge.difficulty)} font-semibold text-xs`}>
                                {challenge.difficulty}
                              </Badge>
                            </div>

                            {/* Title */}
                            <h3 className="font-bold text-lg text-charcoal mb-3 text-center leading-tight">
                              {challenge.title}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-gray-600 mb-4 text-center leading-relaxed">
                              {challenge.description}
                            </p>

                            {/* Stats */}
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Reward:</span>
                                <span className="font-semibold text-purple-600">+{challenge.xpReward} XP</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Time:</span>
                                <span className="font-semibold text-blue-600">{challenge.estimatedTime}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500">Success Rate:</span>
                                <span className="font-semibold text-green-600">{challenge.completionRate}%</span>
                              </div>
                            </div>

                            {/* Stars */}
                            <div className="flex justify-center mb-4">
                              {renderStars(challenge.starsEarned, challenge.maxStars)}
                            </div>

                            {/* Action Button */}
                            {challenge.isUnlocked && (
                              <Button
                                size="sm"
                                className={`w-full ${
                                  challenge.isCompleted ? "bg-green-500 hover:bg-green-600" : "btn-gradient"
                                } text-white font-bold shadow-lg`}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                {challenge.isCompleted ? "Play Again" : "Start Challenge"}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      {!challenge.isUnlocked && (
                        <TooltipContent>
                          <p>Complete previous challenge to unlock</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Mobile & Tablet: Vertical Layout */}
          <div className="lg:hidden space-y-6">
            {challenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`relative overflow-hidden border-2 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer ${
                          challenge.isUnlocked
                            ? "hover:scale-[1.02] border-gray-200 hover:border-teal-300"
                            : "border-gray-300 opacity-60 cursor-not-allowed"
                        } ${challenge.isCompleted ? "ring-2 ring-green-400" : ""}`}
                        onClick={() => handleChallengeClick(challenge)}
                      >
                        {/* Gradient Header */}
                        <div className={`h-2 bg-gradient-to-r ${challenge.color.primary}`} />

                        {/* Lock Overlay */}
                        {!challenge.isUnlocked && (
                          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="bg-white rounded-full p-4 shadow-lg">
                              <Lock className="w-8 h-8 text-gray-600" />
                            </div>
                          </div>
                        )}

                        {/* Completion Badge */}
                        {challenge.isCompleted && (
                          <div className="absolute top-4 right-4 z-20">
                            <div className="bg-green-500 rounded-full p-2 shadow-lg">
                              <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        )}

                        <CardContent className="p-6">
                          <div className="flex items-start gap-6">
                            {/* Left: Icon & Level */}
                            <div className="text-center flex-shrink-0">
                              <div className="text-5xl mb-2">{challenge.icon}</div>
                              <div className="text-2xl font-black text-charcoal mb-1">Level {challenge.id}</div>
                              <Badge className={`${getDifficultyColor(challenge.difficulty)} font-semibold text-xs`}>
                                {challenge.difficulty}
                              </Badge>
                            </div>

                            {/* Right: Content */}
                            <div className="flex-1">
                              <h3 className="font-bold text-xl text-charcoal mb-2">{challenge.title}</h3>
                              <p className="text-gray-600 mb-4 leading-relaxed">{challenge.description}</p>

                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-4 h-4 text-purple-600" />
                                  <span className="text-sm font-semibold">+{challenge.xpReward} XP</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-semibold">{challenge.estimatedTime}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm">{challenge.participantCount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                  <span className="text-sm">{challenge.completionRate}% success</span>
                                </div>
                              </div>

                              {/* Stars & Button */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {renderStars(challenge.starsEarned, challenge.maxStars)}
                                  <span className="text-sm text-gray-500">
                                    {challenge.starsEarned}/{challenge.maxStars}
                                  </span>
                                </div>
                                {challenge.isUnlocked && (
                                  <Button
                                    className={`${
                                      challenge.isCompleted ? "bg-green-500 hover:bg-green-600" : "btn-gradient"
                                    } text-white font-bold shadow-lg`}
                                  >
                                    <Play className="w-4 h-4 mr-2" />
                                    {challenge.isCompleted ? "Play Again" : "Start"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    {!challenge.isUnlocked && (
                      <TooltipContent>
                        <p>Complete previous challenge to unlock</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Progress Indicator */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.0 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-charcoal mb-4">Your Journey Progress</h3>
              <Progress
                value={(challenges.filter((c) => c.isCompleted).length / challenges.length) * 100}
                className="h-3 mb-3"
              />
              <p className="text-sm text-gray-600">
                {challenges.filter((c) => c.isCompleted).length} of {challenges.length} challenges completed
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Complete challenges in order to unlock advanced levels and earn more XP!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
