"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Bot, User, Trophy, RotateCcw } from "lucide-react"
import Link from "next/link"
import { loadGameSession } from "@/lib/game-data"
import type { GameSession } from "@/lib/types"

export default function ResultsPage() {
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const session = loadGameSession()
    if (session) {
      setGameSession(session)
    }
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading results...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameSession || !gameSession.currentPlan || !gameSession.currentFix) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Results Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Please complete a challenge first to see results.</p>
            <Link href="/challenge">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">Start Challenge</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { currentPlan, currentFix, currentUser } = gameSession

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="border-gray-300 bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ENARC Challenge Results</h1>
              <p className="text-gray-600">AI vs Human comparison for {currentPlan.title}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/leaderboard">
              <Button variant="outline" className="border-gray-300 bg-transparent">
                <Trophy className="w-4 h-4 mr-2" />
                View Leaderboard
              </Button>
            </Link>
            <Link href="/challenge">
              <Button className="bg-teal-600 hover:bg-teal-700">
                <RotateCcw className="w-4 h-4 mr-2" />
                New Challenge
              </Button>
            </Link>
          </div>
        </div>

        {/* User Info */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{currentUser?.name}</h3>
                <p className="text-sm text-gray-600">
                  {currentUser?.institution} • {new Date(currentFix.timestamp).toLocaleDateString()}
                </p>
              </div>
              <Badge className="bg-teal-600">
                Total Score: {currentFix.score_accuracy + currentFix.score_design + currentFix.score_minimalism}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Plan Comparison */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* AI Fix */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-gray-600" />
                <CardTitle className="text-lg text-gray-900">AI Fix</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/2] bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={currentPlan.ai_fix_url || "/placeholder.svg"}
                  alt="AI Fixed Floorplan"
                  className="w-full h-full object-cover"
                />
              </div>
            </CardContent>
          </Card>

          {/* Human Fix */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" />
                <CardTitle className="text-lg text-gray-900">Your Fix</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-[3/2] bg-white border-2 border-teal-200 rounded-lg overflow-hidden">
                <img
                  src={currentFix.human_fix_url || "/placeholder.svg"}
                  alt="Human Fixed Floorplan"
                  className="w-full h-full object-cover"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-teal-600" />
              Score Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-teal-50 rounded-lg border border-teal-200">
                <h3 className="font-semibold text-gray-900 mb-2">Accuracy</h3>
                <p className="text-3xl font-bold text-teal-600">{currentFix.score_accuracy}</p>
                <p className="text-sm text-gray-600 mt-1">Code compliance & measurements</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Design Logic</h3>
                <p className="text-3xl font-bold text-gray-600">{currentFix.score_design}</p>
                <p className="text-sm text-gray-600 mt-1">Workflow & functionality</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Minimalism</h3>
                <p className="text-3xl font-bold text-gray-600">{currentFix.score_minimalism}</p>
                <p className="text-sm text-gray-600 mt-1">Simplicity & elegance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">Performance Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Areas where human beat AI */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Top Areas Where You Beat AI
                </h3>
                <ul className="space-y-2">
                  {currentFix.human_better_areas.map((area, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-1 mt-0.5 bg-green-100 border-green-300 text-green-700"
                      >
                        {index + 1}
                      </Badge>
                      <span className="text-sm text-green-700">{area}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-green-600 mt-4 font-medium">
                  Great job! You excelled in: {currentFix.human_better_areas.join(", ")}. Keep up the great work on the
                  ENARC challenges!
                </p>
              </div>

              {/* Areas where AI was better */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Areas for Improvement
                </h3>
                <ul className="space-y-2">
                  {currentFix.ai_better_areas.map((area, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-1 mt-0.5 bg-blue-100 border-blue-300 text-blue-700"
                      >
                        {index + 1}
                      </Badge>
                      <span className="text-sm text-blue-700">{area}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-blue-600 mt-4">
                  Focus on these areas in your next ENARC challenge to improve your score.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
