"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, Trophy, Target, Clock, Star } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { RoomFlowGame } from "@/components/room-flow-game"
import { EnarcLogoSmall } from "@/components/enarc-logo"
import { saveGameSession, saveFix, saveUser } from "@/lib/game-data"

interface GameLevel {
  id: number
  title: string
  difficulty: string
  description: string
  estimatedTime: string
  targetScore: number
  xpReward: number
}

export default function RoomFlowGamePage() {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  const gameLevels: GameLevel[] = [
    {
      id: 1,
      title: "Studio Apartment Flow",
      difficulty: "Beginner",
      description: "Arrange a compact studio for optimal living flow",
      estimatedTime: "5 min",
      targetScore: 80,
      xpReward: 150,
    },
    {
      id: 2,
      title: "Compact 1BHK",
      difficulty: "Intermediate",
      description: "Optimize flow in a one-bedroom apartment layout",
      estimatedTime: "7 min",
      targetScore: 85,
      xpReward: 250,
    },
    {
      id: 3,
      title: "Spacious 2BHK",
      difficulty: "Advanced",
      description: "Master flow in a two-bedroom family apartment",
      estimatedTime: "10 min",
      targetScore: 88,
      xpReward: 400,
    },
    {
      id: 4,
      title: "Duplex Unit Layout",
      difficulty: "Expert",
      description: "Handle complex multi-level circulation challenges",
      estimatedTime: "12 min",
      targetScore: 90,
      xpReward: 600,
    },
    {
      id: 5,
      title: "Multi-unit Floor Plan",
      difficulty: "Master Architect",
      description: "Optimize entire floor with multiple units",
      estimatedTime: "15 min",
      targetScore: 92,
      xpReward: 1000,
    },
  ]

  useEffect(() => {
    // Check if level is specified in URL params
    const levelParam = searchParams.get("level")
    if (levelParam) {
      const levelId = Number.parseInt(levelParam)
      if (levelId >= 1 && levelId <= 5) {
        setSelectedLevel(levelId)
        setGameStarted(true)
      }
    }
    setIsLoading(false)
  }, [searchParams])

  const handleLevelSelect = (levelId: number) => {
    setSelectedLevel(levelId)
    setGameStarted(true)
  }

  const handleGameComplete = (score: number, efficiency: number, stars: number) => {
    // Save game results to existing ENARC systems
    const level = gameLevels.find((l) => l.id === selectedLevel)
    if (!level) return

    // Create user data
    const userData = {
      id: Date.now().toString(),
      name: "Current Player", // This would come from auth in real app
      email: "player@example.com",
      institution: "ENARC Academy",
      total_score: score,
    }

    const savedUser = saveUser(userData)

    // Create fix/result data for leaderboard integration
    const fix = {
      id: Date.now().toString(),
      plan_id: `room-flow-${selectedLevel}`,
      user_id: savedUser.id,
      human_fix_url: "/placeholder.svg?height=400&width=600&text=Room+Flow+Solution",
      score_accuracy: efficiency,
      score_design: Math.min(100, efficiency + 5),
      score_minimalism: Math.min(100, efficiency - 5),
      ai_better_areas: efficiency < 90 ? ["circulation optimization", "adjacency planning"] : [],
      human_better_areas: efficiency > 75 ? ["creative space usage", "flow innovation"] : [],
      timestamp: new Date().toISOString(),
    }

    saveFix(fix)

    // Save game session
    const gameSession = {
      currentPlan: {
        id: `room-flow-${selectedLevel}`,
        title: level.title,
        faulty_plan_url: "/placeholder.svg?height=400&width=600&text=Original+Layout",
        ai_fix_url: "/placeholder.svg?height=400&width=600&text=Optimal+Layout",
        description: level.description,
      },
      currentUser: savedUser,
      currentFix: fix,
    }

    saveGameSession(gameSession)

    // Navigate to results page
    router.push("/results")
  }

  const handleGameExit = () => {
    setGameStarted(false)
    setSelectedLevel(null)
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      Beginner: "bg-green-100 text-green-800 border-green-300",
      Intermediate: "bg-blue-100 text-blue-800 border-blue-300",
      Advanced: "bg-purple-100 text-purple-800 border-purple-300",
      Expert: "bg-orange-100 text-orange-800 border-orange-300",
      "Master Architect": "bg-gradient-to-r from-red-500 to-pink-500 text-white border-red-400",
    }
    return colors[difficulty as keyof typeof colors] || colors["Beginner"]
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
            <p className="text-gray-600 font-medium">Loading Room Flow Game...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameStarted && selectedLevel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 blueprint-bg" />
        </div>

        <div className="relative z-10">
          <RoomFlowGame levelId={selectedLevel} onGameComplete={handleGameComplete} onGameExit={handleGameExit} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
      {/* Background Pattern */}
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
            <span className="text-lg font-bold text-charcoal">Room Flow Optimization</span>
          </div>
          <div className="w-24" />
        </motion.div>

        {/* Title Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-5xl font-black text-charcoal mb-4">Room Flow Optimization Game</h1>
          <p className="text-xl text-gray-600 font-medium max-w-3xl mx-auto leading-relaxed">
            Master the art of spatial arrangement by optimizing room layouts for perfect circulation flow and
            connectivity
          </p>
        </motion.div>

        {/* Game Description */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-gray-100 shadow-xl max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-xl text-charcoal text-center">How to Play</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-charcoal mb-2">Drag & Drop</h3>
                  <p className="text-sm text-gray-600">
                    Drag room blocks from the palette onto the grid to create your layout
                  </p>
                </div>
                <div>
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-charcoal mb-2">Optimize Flow</h3>
                  <p className="text-sm text-gray-600">
                    Arrange rooms for optimal adjacency and circulation efficiency
                  </p>
                </div>
                <div>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-bold text-charcoal mb-2">Earn Stars</h3>
                  <p className="text-sm text-gray-600">Score high on flow efficiency to earn up to 3 stars per level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Level Selection */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h2 className="text-2xl font-bold text-charcoal text-center mb-8">Select Your Challenge Level</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {gameLevels.map((level, index) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              >
                <Card className="border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group">
                  <div className="h-2 bg-gradient-to-r from-teal-400 to-teal-500" />
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <div className="text-3xl mb-2">🏠</div>
                      <div className="text-xl font-black text-charcoal mb-2">Level {level.id}</div>
                      <Badge className={`${getDifficultyColor(level.difficulty)} font-semibold text-xs px-3 py-1`}>
                        {level.difficulty}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-lg text-charcoal mb-3 text-center">{level.title}</h3>
                    <p className="text-sm text-gray-600 mb-4 text-center leading-relaxed">{level.description}</p>

                    <div className="space-y-2 mb-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Duration:</span>
                        <span className="font-bold text-blue-600">{level.estimatedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target:</span>
                        <span className="font-bold text-green-600">{level.targetScore}% efficiency</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reward:</span>
                        <span className="font-bold text-purple-600">+{level.xpReward} XP</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleLevelSelect(level.id)}
                      className="w-full btn-gradient text-white font-bold shadow-lg group-hover:shadow-xl"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Level
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Game Features */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          <Card className="bg-white/90 backdrop-blur-sm border-2 border-gray-100 shadow-lg max-w-4xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-charcoal mb-6">Game Features</h3>
              <div className="grid md:grid-cols-4 gap-6 text-sm">
                <div className="text-center">
                  <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="font-semibold text-charcoal">Timed Challenges</div>
                  <div className="text-gray-600">Race against time</div>
                </div>
                <div className="text-center">
                  <Target className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="font-semibold text-charcoal">Flow Scoring</div>
                  <div className="text-gray-600">Efficiency metrics</div>
                </div>
                <div className="text-center">
                  <Trophy className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="font-semibold text-charcoal">Star Ratings</div>
                  <div className="text-gray-600">Performance tracking</div>
                </div>
                <div className="text-center">
                  <Star className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="font-semibold text-charcoal">Progressive Levels</div>
                  <div className="text-gray-600">Increasing complexity</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
