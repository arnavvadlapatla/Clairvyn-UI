"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Target, Trophy, Award } from "lucide-react"

export function ProgressTracker() {
  // Mock user progress data - will be replaced with real data from Users collection
  const userProgress = {
    currentRank: 12,
    challengesCompleted: 3,
    totalChallenges: 10,
    totalScore: 2456,
    level: "Advanced Beginner",
  }

  const progressPercentage = (userProgress.challengesCompleted / userProgress.totalChallenges) * 100

  return (
    <motion.div
      className="mb-12"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.9 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-charcoal mb-2">Your Progress</h2>
        <p className="text-gray-600">Track your ENARC progress</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {/* Current Rank */}
        <motion.div whileHover={{ scale: 1.05, y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="bg-gradient-to-r from-teal-600 to-teal-700 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Trophy className="w-5 h-5 text-white mr-2" />
                <span className="text-white font-semibold text-sm">Current Rank</span>
              </div>
              <div className="text-2xl font-black text-white">#{userProgress.currentRank}</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Challenges Completed */}
        <motion.div whileHover={{ scale: 1.05, y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Target className="w-5 h-5 text-white mr-2" />
                <span className="text-white font-semibold text-sm">Completed</span>
              </div>
              <div className="text-2xl font-black text-white">
                {userProgress.challengesCompleted}/{userProgress.totalChallenges}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Score */}
        <motion.div whileHover={{ scale: 1.05, y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-white mr-2" />
                <span className="text-white font-semibold text-sm">Total Score</span>
              </div>
              <div className="text-2xl font-black text-white">{userProgress.totalScore.toLocaleString()}</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Level */}
        <motion.div whileHover={{ scale: 1.05, y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                <Award className="w-5 h-5 text-white mr-2" />
                <span className="text-white font-semibold text-sm">Level</span>
              </div>
              <div className="text-sm font-black text-white">{userProgress.level}</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <motion.div
        className="max-w-2xl mx-auto mt-6"
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
      >
        <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-teal-500 to-green-500 h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1.5, delay: 1.4, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Progress to Next Level</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
      </motion.div>
    </motion.div>
  )
}
