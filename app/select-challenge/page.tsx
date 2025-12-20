"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Lock, Star, ArrowLeft, Play, CheckCircle, Zap, Clock, Users, Trophy, Target, Award } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { EnarcLogoSmall } from "@/components/enarc-logo"

interface Challenge {
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
  icon: string
  unlockRequirement?: string
}

export default function SelectChallengePage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [userStats, setUserStats] = useState({ totalStars: 0, totalXP: 0, completedChallenges: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Challenge data with progressive difficulty
  const challengeData: Challenge[] = [
    {
      id: 1,
      title: "Efficient Studio Layout",
      difficulty: "Beginner",
      description: "Master the fundamentals of space optimization in a compact studio apartment.",
      isUnlocked: true,
      isCompleted: true,
      starsEarned: 3,
      maxStars: 3,
      xpReward: 150,
      estimatedTime: "10-15 min",
      participantCount: 3247,
      icon: "🏠",
    },
    {
      id: 2,
      title: "2BHK Ventilation Fix",
      difficulty: "Intermediate",
      description: "Learn ventilation principles and natural lighting optimization techniques.",
      isUnlocked: true,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 250,
      estimatedTime: "15-20 min",
      participantCount: 2156,
      icon: "🌬️",
      unlockRequirement: "Complete Studio Layout",
    },
    {
      id: 3,
      title: "Accessibility Upgrade",
      difficulty: "Advanced",
      description: "Apply universal design principles and ensure ADA compliance standards.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 400,
      estimatedTime: "20-25 min",
      participantCount: 1543,
      icon: "♿",
      unlockRequirement: "Complete Ventilation Fix",
    },
    {
      id: 4,
      title: "Duplex Optimization",
      difficulty: "Expert",
      description: "Handle complex multi-level design with vertical circulation challenges.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 600,
      estimatedTime: "25-30 min",
      participantCount: 892,
      icon: "🏢",
      unlockRequirement: "Complete Accessibility Upgrade",
    },
    {
      id: 5,
      title: "Skyscraper Lobby Design",
      difficulty: "Master Architect",
      description: "Master commercial space design with complex circulation and impressive aesthetics.",
      isUnlocked: false,
      isCompleted: false,
      starsEarned: 0,
      maxStars: 3,
      xpReward: 1000,
      estimatedTime: "30-40 min",
      participantCount: 234,
      icon: "🏗️",
      unlockRequirement: "Complete Duplex Optimization",
    },
  ]

  useEffect(() => {
    loadChallenges()
  }, [])

  const loadChallenges = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 600))

    setChallenges(challengeData)

    // Calculate user statistics
    const totalStars = challengeData.reduce((sum, challenge) => sum + challenge.starsEarned, 0)
    const totalXP = challengeData
      .filter((challenge) => challenge.isCompleted)
      .reduce((sum, challenge) => sum + challenge.xpReward, 0)
    const completedChallenges = challengeData.filter((challenge) => challenge.isCompleted).length

    setUserStats({ totalStars, totalXP, completedChallenges })
    setIsLoading(false)
  }

  const getDifficultyStyle = (difficulty: string) => {
    const styles = {
      Beginner: "bg-green-100 text-green-800 border-green-300",
      Intermediate: "bg-blue-100 text-blue-800 border-blue-300",
      Advanced: "bg-purple-100 text-purple-800 border-purple-300",
      Expert: "bg-orange-100 text-orange-800 border-orange-300",
      "Master Architect": "bg-gradient-to-r from-red-500 to-pink-500 text-white border-red-400",
    }
    return styles[difficulty as keyof typeof styles] || styles.Beginner
  }

  const handleChallengeClick = (challenge: Challenge) => {
    if (!challenge.isUnlocked) return

    // Store selected challenge for the challenge page
    localStorage.setItem("selectedChallenge", JSON.stringify(challenge))
    router.push("/challenge")
  }

  const renderStars = (earned: number, max: number) => (
    <div className="flex justify-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < earned ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
      ))}
    </div>
  )

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
            <p className="text-gray-600 font-medium">Loading challenges...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Architectural Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 blueprint-bg" />
        <div className="absolute inset-0 geometric-overlay" />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Link href="/">
            <Button variant="outline" size="sm" className="border-gray-300 bg-white/80 backdrop-blur-sm hover:bg-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <EnarcLogoSmall size={32} />
            <span className="text-lg font-bold text-charcoal">ENARC Challenges</span>
          </div>
          <div className="w-24" /> {/* Spacer for centering */}
        </motion.div>

        {/* Title Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-5xl font-black text-charcoal mb-4">Select Your Challenge</h1>
          <p className="text-xl text-gray-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Sharpen your spatial design skills step by step through progressive architectural challenges
          </p>
        </motion.div>

        {/* User Progress Overview */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-gray-100 shadow-xl max-w-4xl mx-auto">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6">
                    <Trophy className="w-10 h-10 text-teal-600 mx-auto mb-3" />
                    <div className="text-3xl font-black text-charcoal">{userStats.totalStars}</div>
                    <div className="text-sm text-gray-600 font-medium">Stars Earned</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
                    <Zap className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                    <div className="text-3xl font-black text-charcoal">{userStats.totalXP}</div>
                    <div className="text-sm text-gray-600 font-medium">Experience Points</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                    <Target className="w-10 h-10 text-green-600 mx-auto mb-3" />
                    <div className="text-3xl font-black text-charcoal">
                      {userStats.completedChallenges}/{challenges.length}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">Challenges Complete</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Challenge Cards - Desktop Horizontal Layout */}
        <div className="hidden lg:block mb-12">
          <div className="grid grid-cols-5 gap-6 max-w-7xl mx-auto">
            {challenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card
                        className={`relative overflow-hidden border-2 shadow-xl transition-all duration-300 cursor-pointer group h-full ${
                          challenge.isUnlocked
                            ? "hover:scale-105 hover:shadow-2xl border-gray-200 hover:border-teal-300"
                            : "border-gray-300 opacity-60 cursor-not-allowed"
                        } ${challenge.isCompleted ? "ring-2 ring-green-400" : ""}`}
                        onClick={() => handleChallengeClick(challenge)}
                      >
                        {/* Top Gradient Bar */}
                        <div
                          className={`h-2 ${
                            challenge.isCompleted
                              ? "bg-gradient-to-r from-green-400 to-green-500"
                              : challenge.isUnlocked
                                ? "bg-gradient-to-r from-teal-400 to-teal-500"
                                : "bg-gray-300"
                          }`}
                        />

                        {/* Lock Overlay */}
                        {!challenge.isUnlocked && (
                          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] flex items-center justify-center z-10">
                            <div className="bg-white rounded-full p-3 shadow-lg">
                              <Lock className="w-6 h-6 text-gray-600" />
                            </div>
                          </div>
                        )}

                        {/* Completion Badge */}
                        {challenge.isCompleted && (
                          <div className="absolute top-4 right-4 z-20">
                            <div className="bg-green-500 rounded-full p-1.5 shadow-lg">
                              <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}

                        <CardContent className="p-6 h-full flex flex-col">
                          {/* Level Icon & Number */}
                          <div className="text-center mb-4">
                            <div className="text-4xl mb-3">{challenge.icon}</div>
                            <div className="text-2xl font-black text-charcoal mb-2">Level {challenge.id}</div>
                            <Badge
                              className={`${getDifficultyStyle(challenge.difficulty)} font-semibold text-xs px-3 py-1`}
                            >
                              {challenge.difficulty}
                            </Badge>
                          </div>

                          {/* Title */}
                          <h3 className="font-bold text-lg text-charcoal mb-3 text-center leading-tight flex-grow">
                            {challenge.title}
                          </h3>

                          {/* Description */}
                          <p className="text-sm text-gray-600 mb-4 text-center leading-relaxed">
                            {challenge.description}
                          </p>

                          {/* Stats */}
                          <div className="space-y-2 mb-4 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Reward:</span>
                              <span className="font-bold text-purple-600">+{challenge.xpReward} XP</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Duration:</span>
                              <span className="font-bold text-blue-600">{challenge.estimatedTime}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Players:</span>
                              <span className="font-bold text-gray-700">
                                {challenge.participantCount.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Stars */}
                          <div className="mb-4">{renderStars(challenge.starsEarned, challenge.maxStars)}</div>

                          {/* Action Button */}
                          {challenge.isUnlocked && (
                            <Button
                              size="sm"
                              className={`w-full font-bold shadow-lg ${
                                challenge.isCompleted
                                  ? "bg-green-500 hover:bg-green-600 text-white"
                                  : "btn-gradient text-white"
                              }`}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              {challenge.isCompleted ? "Replay" : "Start"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </TooltipTrigger>
                    {!challenge.isUnlocked && (
                      <TooltipContent>
                        <p className="font-medium">🔒 Complete previous challenge to unlock</p>
                        {challenge.unlockRequirement && (
                          <p className="text-xs text-gray-500 mt-1">{challenge.unlockRequirement}</p>
                        )}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Challenge Cards - Mobile/Tablet Vertical Layout */}
        <div className="lg:hidden space-y-6 mb-12">
          {challenges.map((challenge, index) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card
                      className={`relative overflow-hidden border-2 shadow-xl transition-all duration-300 cursor-pointer ${
                        challenge.isUnlocked
                          ? "hover:scale-[1.02] hover:shadow-2xl border-gray-200 hover:border-teal-300"
                          : "border-gray-300 opacity-60 cursor-not-allowed"
                      } ${challenge.isCompleted ? "ring-2 ring-green-400" : ""}`}
                      onClick={() => handleChallengeClick(challenge)}
                    >
                      {/* Top Gradient Bar */}
                      <div
                        className={`h-2 ${
                          challenge.isCompleted
                            ? "bg-gradient-to-r from-green-400 to-green-500"
                            : challenge.isUnlocked
                              ? "bg-gradient-to-r from-teal-400 to-teal-500"
                              : "bg-gray-300"
                        }`}
                      />

                      {/* Lock Overlay */}
                      {!challenge.isUnlocked && (
                        <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] flex items-center justify-center z-10">
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
                            <div className="text-xl font-black text-charcoal mb-2">Level {challenge.id}</div>
                            <Badge
                              className={`${getDifficultyStyle(challenge.difficulty)} font-semibold text-xs px-2 py-1`}
                            >
                              {challenge.difficulty}
                            </Badge>
                          </div>

                          {/* Right: Content */}
                          <div className="flex-1">
                            <h3 className="font-bold text-xl text-charcoal mb-2">{challenge.title}</h3>
                            <p className="text-gray-600 mb-4 leading-relaxed">{challenge.description}</p>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-purple-600" />
                                <span className="font-semibold">+{challenge.xpReward} XP</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold">{challenge.estimatedTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-600" />
                                <span>{challenge.participantCount.toLocaleString()} players</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-yellow-600" />
                                <span>
                                  {challenge.starsEarned}/{challenge.maxStars} stars
                                </span>
                              </div>
                            </div>

                            {/* Stars & Button */}
                            <div className="flex items-center justify-between">
                              <div>{renderStars(challenge.starsEarned, challenge.maxStars)}</div>
                              {challenge.isUnlocked && (
                                <Button
                                  className={`font-bold shadow-lg ${
                                    challenge.isCompleted
                                      ? "bg-green-500 hover:bg-green-600 text-white"
                                      : "btn-gradient text-white"
                                  }`}
                                >
                                  <Play className="w-4 h-4 mr-2" />
                                  {challenge.isCompleted ? "Replay" : "Start"}
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
                      <p className="font-medium">🔒 Complete previous challenge to unlock</p>
                      {challenge.unlockRequirement && (
                        <p className="text-xs text-gray-500 mt-1">{challenge.unlockRequirement}</p>
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          ))}
        </div>

        {/* Overall Progress */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-gray-100 shadow-lg max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-charcoal mb-4 flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-teal-600" />
                Your Learning Journey
              </h3>
              <Progress value={(userStats.completedChallenges / challenges.length) * 100} className="h-3 mb-4" />
              <p className="text-gray-600 font-medium">
                {userStats.completedChallenges} of {challenges.length} challenges completed
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Complete challenges sequentially to unlock advanced levels and master architectural design!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
