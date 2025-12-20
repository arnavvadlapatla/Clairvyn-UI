"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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
  RotateCcw,
  Send,
  Lightbulb,
  Clock,
  Target,
  Star,
  CheckCircle,
  AlertCircle,
  Move,
  Grid3X3,
  Zap,
  Trophy,
  Eye,
  EyeOff,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Room {
  id: string
  name: string
  area: number // in sq ft
  color: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  isPlaced: boolean
  connections: string[] // IDs of rooms that should be adjacent
  priority: number // 1-5, higher = more important for flow
}

interface GameLevel {
  id: number
  title: string
  difficulty: string
  description: string
  rooms: Room[]
  gridSize: { width: number; height: number }
  hints: string[]
  timeLimit: number // in seconds
  targetScore: number
}

interface GameState {
  currentLevel: GameLevel
  rooms: Room[]
  score: number
  flowEfficiency: number
  timeLeft: number
  isGameActive: boolean
  showHints: boolean
  showRules: boolean
  draggedRoom: string | null
}

interface RoomFlowGameProps {
  levelId: number
  onGameComplete: (score: number, efficiency: number, stars: number) => void
  onGameExit: () => void
}

export function RoomFlowGame({ levelId, onGameComplete, onGameExit }: RoomFlowGameProps) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [gameResult, setGameResult] = useState<{
    score: number
    efficiency: number
    stars: number
    feedback: string[]
  } | null>(null)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Game levels with progressive complexity
  const gameLevels: GameLevel[] = [
    {
      id: 1,
      title: "Studio Apartment Flow",
      difficulty: "Beginner",
      description: "Arrange a compact studio for optimal living flow",
      gridSize: { width: 6, height: 4 },
      timeLimit: 300, // 5 minutes
      targetScore: 80,
      hints: [
        "Place the kitchen near the living area for easy meal service",
        "Keep the bathroom accessible but private from the main living space",
      ],
      rooms: [
        {
          id: "living",
          name: "Living Area",
          area: 200,
          color: "#e8f5e8",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          isPlaced: false,
          connections: ["kitchen", "bedroom"],
          priority: 5,
        },
        {
          id: "kitchen",
          name: "Kitchen",
          area: 80,
          color: "#fff2e8",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 1 },
          isPlaced: false,
          connections: ["living"],
          priority: 4,
        },
        {
          id: "bedroom",
          name: "Bedroom",
          area: 120,
          color: "#f0f8ff",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 1 },
          isPlaced: false,
          connections: ["living", "bathroom"],
          priority: 3,
        },
        {
          id: "bathroom",
          name: "Bathroom",
          area: 40,
          color: "#f8f0ff",
          position: { x: 0, y: 0 },
          size: { width: 1, height: 1 },
          isPlaced: false,
          connections: ["bedroom"],
          priority: 2,
        },
      ],
    },
    {
      id: 2,
      title: "Compact 1BHK",
      difficulty: "Intermediate",
      description: "Optimize flow in a one-bedroom apartment layout",
      gridSize: { width: 8, height: 6 },
      timeLimit: 420, // 7 minutes
      targetScore: 85,
      hints: [
        "Create a clear separation between public and private zones",
        "Ensure the kitchen has easy access to both living and dining areas",
      ],
      rooms: [
        {
          id: "living",
          name: "Living Room",
          area: 180,
          color: "#e8f5e8",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          isPlaced: false,
          connections: ["kitchen", "dining", "bedroom"],
          priority: 5,
        },
        {
          id: "kitchen",
          name: "Kitchen",
          area: 100,
          color: "#fff2e8",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          isPlaced: false,
          connections: ["living", "dining"],
          priority: 4,
        },
        {
          id: "dining",
          name: "Dining",
          area: 80,
          color: "#f5f5dc",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 1 },
          isPlaced: false,
          connections: ["kitchen", "living"],
          priority: 3,
        },
        {
          id: "bedroom",
          name: "Bedroom",
          area: 150,
          color: "#f0f8ff",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          isPlaced: false,
          connections: ["living", "bathroom"],
          priority: 4,
        },
        {
          id: "bathroom",
          name: "Bathroom",
          area: 50,
          color: "#f8f0ff",
          position: { x: 0, y: 0 },
          size: { width: 1, height: 2 },
          isPlaced: false,
          connections: ["bedroom"],
          priority: 2,
        },
      ],
    },
    // Additional levels would follow similar pattern...
  ]

  useEffect(() => {
    initializeGame()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [levelId])

  const initializeGame = () => {
    const level = gameLevels.find((l) => l.id === levelId) || gameLevels[0]
    const initialRooms = level.rooms.map((room) => ({
      ...room,
      position: { x: 0, y: 0 },
      isPlaced: false,
    }))

    setGameState({
      currentLevel: level,
      rooms: initialRooms,
      score: 0,
      flowEfficiency: 0,
      timeLeft: level.timeLimit,
      isGameActive: true,
      showHints: false,
      showRules: false,
      draggedRoom: null,
    })

    startTimer(level.timeLimit)
  }

  const startTimer = (duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setGameState((prev) => {
        if (!prev || prev.timeLeft <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          handleTimeUp()
          return prev ? { ...prev, timeLeft: 0, isGameActive: false } : null
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 }
      })
    }, 1000)
  }

  const handleTimeUp = () => {
    if (gameState) {
      const result = calculateScore(gameState.rooms)
      setGameResult(result)
      setShowSubmitDialog(true)
    }
  }

  const calculateScore = (rooms: Room[]) => {
    let totalScore = 0
    let efficiency = 0
    const feedback: string[] = []

    // Check if all rooms are placed
    const placedRooms = rooms.filter((room) => room.isPlaced)
    if (placedRooms.length !== rooms.length) {
      feedback.push("Not all rooms were placed on the grid")
      return { score: 0, efficiency: 0, stars: 0, feedback }
    }

    // Calculate adjacency score
    let adjacencyScore = 0
    let maxAdjacencyScore = 0

    rooms.forEach((room) => {
      room.connections.forEach((connectionId) => {
        maxAdjacencyScore += room.priority
        const connectedRoom = rooms.find((r) => r.id === connectionId)
        if (connectedRoom && areAdjacent(room, connectedRoom)) {
          adjacencyScore += room.priority
        }
      })
    })

    // Calculate overlap penalty
    let overlapPenalty = 0
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (roomsOverlap(rooms[i], rooms[j])) {
          overlapPenalty += 20
        }
      }
    }

    // Calculate circulation efficiency
    const circulationScore = calculateCirculationEfficiency(rooms)

    // Final score calculation
    const baseScore = Math.max(0, (adjacencyScore / maxAdjacencyScore) * 100)
    totalScore = Math.max(0, baseScore + circulationScore - overlapPenalty)
    efficiency = Math.round(totalScore)

    // Generate feedback
    if (adjacencyScore / maxAdjacencyScore > 0.8) {
      feedback.push("Excellent room adjacency planning!")
    } else if (adjacencyScore / maxAdjacencyScore > 0.6) {
      feedback.push("Good room connections, but some improvements possible")
    } else {
      feedback.push("Consider better room adjacency for improved flow")
    }

    if (overlapPenalty > 0) {
      feedback.push("Room overlaps detected - ensure proper spacing")
    }

    if (circulationScore > 15) {
      feedback.push("Great circulation path optimization!")
    }

    // Calculate stars
    let stars = 0
    if (efficiency >= 90) stars = 3
    else if (efficiency >= 75) stars = 2
    else if (efficiency >= 60) stars = 1

    return { score: Math.round(totalScore), efficiency, stars, feedback }
  }

  const areAdjacent = (room1: Room, room2: Room): boolean => {
    const r1 = {
      left: room1.position.x,
      right: room1.position.x + room1.size.width,
      top: room1.position.y,
      bottom: room1.position.y + room1.size.height,
    }
    const r2 = {
      left: room2.position.x,
      right: room2.position.x + room2.size.width,
      top: room2.position.y,
      bottom: room2.position.y + room2.size.height,
    }

    // Check if rooms share an edge
    const shareVerticalEdge =
      (r1.right === r2.left || r1.left === r2.right) && !(r1.bottom <= r2.top || r1.top >= r2.bottom)
    const shareHorizontalEdge =
      (r1.bottom === r2.top || r1.top === r2.bottom) && !(r1.right <= r2.left || r1.left >= r2.right)

    return shareVerticalEdge || shareHorizontalEdge
  }

  const roomsOverlap = (room1: Room, room2: Room): boolean => {
    const r1 = {
      left: room1.position.x,
      right: room1.position.x + room1.size.width,
      top: room1.position.y,
      bottom: room1.position.y + room1.size.height,
    }
    const r2 = {
      left: room2.position.x,
      right: room2.position.x + room2.size.width,
      top: room2.position.y,
      bottom: room2.position.y + room2.size.height,
    }

    return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom)
  }

  const calculateCirculationEfficiency = (rooms: Room[]): number => {
    // Simplified circulation calculation based on central accessibility
    const center = {
      x: (gameState?.currentLevel.gridSize.width || 6) / 2,
      y: (gameState?.currentLevel.gridSize.height || 4) / 2,
    }

    let totalDistance = 0
    rooms.forEach((room) => {
      const roomCenter = {
        x: room.position.x + room.size.width / 2,
        y: room.position.y + room.size.height / 2,
      }
      const distance = Math.sqrt(Math.pow(roomCenter.x - center.x, 2) + Math.pow(roomCenter.y - center.y, 2))
      totalDistance += distance * room.priority
    })

    const maxPossibleDistance = rooms.reduce((sum, room) => sum + room.priority, 0) * 5
    return Math.max(0, 20 - (totalDistance / maxPossibleDistance) * 20)
  }

  const handleDragStart = (roomId: string, event: React.DragEvent) => {
    setGameState((prev) => (prev ? { ...prev, draggedRoom: roomId } : null))
    event.dataTransfer.setData("text/plain", roomId)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (!gameState || !gameAreaRef.current) return

    const roomId = event.dataTransfer.getData("text/plain")
    const rect = gameAreaRef.current.getBoundingClientRect()
    const cellSize = 60 // pixels per grid cell

    const gridX = Math.floor((event.clientX - rect.left) / cellSize)
    const gridY = Math.floor((event.clientY - rect.top) / cellSize)

    const room = gameState.rooms.find((r) => r.id === roomId)
    if (!room) return

    // Check if position is valid (within bounds and no overlap)
    if (
      gridX >= 0 &&
      gridY >= 0 &&
      gridX + room.size.width <= gameState.currentLevel.gridSize.width &&
      gridY + room.size.height <= gameState.currentLevel.gridSize.height
    ) {
      const updatedRooms = gameState.rooms.map((r) =>
        r.id === roomId ? { ...r, position: { x: gridX, y: gridY }, isPlaced: true } : r,
      )

      // Check for overlaps with other rooms
      const placedRoom = { ...room, position: { x: gridX, y: gridY } }
      const hasOverlap = updatedRooms.some((r) => r.id !== roomId && r.isPlaced && roomsOverlap(placedRoom, r))

      if (!hasOverlap) {
        setGameState((prev) => (prev ? { ...prev, rooms: updatedRooms, draggedRoom: null } : null))
      }
    }
  }

  const handleReset = () => {
    if (gameState) {
      const resetRooms = gameState.rooms.map((room) => ({
        ...room,
        position: { x: 0, y: 0 },
        isPlaced: false,
      }))
      setGameState({ ...gameState, rooms: resetRooms })
    }
  }

  const handleSubmit = () => {
    if (!gameState) return

    const result = calculateScore(gameState.rooms)
    setGameResult(result)
    setShowSubmitDialog(true)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const handleGameComplete = () => {
    if (gameResult) {
      onGameComplete(gameResult.score, gameResult.efficiency, gameResult.stars)
    }
    setShowSubmitDialog(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-charcoal mb-1">{gameState.currentLevel.title}</h2>
          <p className="text-gray-600">{gameState.currentLevel.description}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="bg-white rounded-xl px-4 py-2 shadow-sm border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-charcoal">Time Left</span>
            </div>
            <div className="text-xl font-black text-charcoal">{formatTime(gameState.timeLeft)}</div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGameState({ ...gameState, showHints: !gameState.showHints })}
              className="border-teal-200 text-teal-600 hover:bg-teal-50"
            >
              {gameState.showHints ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="ml-2">Hints</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-gray-300 hover:bg-gray-50 bg-transparent"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-gradient-to-r from-teal-600 to-green-500 text-white font-bold shadow-lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Solution
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Game Area */}
        <div className="lg:col-span-3">
          {/* Hints Panel */}
          <AnimatePresence>
            {gameState.showHints && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <Card className="border-2 border-teal-200 bg-teal-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Design Hints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {gameState.currentLevel.hints.map((hint, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Badge variant="outline" className="bg-teal-100 border-teal-300 text-teal-700 text-xs">
                            {index + 1}
                          </Badge>
                          <p className="text-sm text-teal-700">{hint}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Grid */}
          <Card className="border-2 border-gray-200 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-teal-600" />
                Room Layout Grid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={gameAreaRef}
                className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
                style={{
                  width: gameState.currentLevel.gridSize.width * 60,
                  height: gameState.currentLevel.gridSize.height * 60,
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Grid Lines */}
                <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 1 }}>
                  {/* Vertical lines */}
                  {Array.from({ length: gameState.currentLevel.gridSize.width + 1 }, (_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={i * 60}
                      y1={0}
                      x2={i * 60}
                      y2={gameState.currentLevel.gridSize.height * 60}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Horizontal lines */}
                  {Array.from({ length: gameState.currentLevel.gridSize.height + 1 }, (_, i) => (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={i * 60}
                      x2={gameState.currentLevel.gridSize.width * 60}
                      y2={i * 60}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                </svg>

                {/* Placed Rooms */}
                {gameState.rooms
                  .filter((room) => room.isPlaced)
                  .map((room) => (
                    <motion.div
                      key={room.id}
                      className="absolute border-2 border-gray-400 rounded-lg shadow-lg cursor-move flex items-center justify-center text-center p-2"
                      style={{
                        left: room.position.x * 60,
                        top: room.position.y * 60,
                        width: room.size.width * 60,
                        height: room.size.height * 60,
                        backgroundColor: room.color,
                        zIndex: 10,
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(room.id, e)}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      whileDrag={{ scale: 1.05, zIndex: 20 }}
                    >
                      <div>
                        <div className="font-semibold text-sm text-charcoal">{room.name}</div>
                        <div className="text-xs text-gray-600">{room.area} sq ft</div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Room Palette */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal flex items-center gap-2">
                <Move className="w-5 h-5 text-teal-600" />
                Room Blocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gameState.rooms
                  .filter((room) => !room.isPlaced)
                  .map((room) => (
                    <motion.div
                      key={room.id}
                      className="border-2 border-gray-300 rounded-lg p-3 cursor-move hover:border-teal-300 hover:shadow-md transition-all"
                      style={{ backgroundColor: room.color }}
                      draggable
                      onDragStart={(e) => handleDragStart(room.id, e)}
                      whileHover={{ scale: 1.02 }}
                      whileDrag={{ scale: 1.05 }}
                    >
                      <div className="text-center">
                        <div className="font-semibold text-sm text-charcoal">{room.name}</div>
                        <div className="text-xs text-gray-600">{room.area} sq ft</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {room.size.width}×{room.size.height} grid
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
              {gameState.rooms.every((room) => room.isPlaced) && (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-600 font-semibold">All rooms placed!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Game Stats */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-black text-teal-600">
                  {gameState.rooms.filter((r) => r.isPlaced).length}/{gameState.rooms.length}
                </div>
                <div className="text-sm text-gray-600">Rooms Placed</div>
              </div>

              <Progress
                value={(gameState.rooms.filter((r) => r.isPlaced).length / gameState.rooms.length) * 100}
                className="h-2"
              />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Score:</span>
                  <span className="font-semibold text-charcoal">{gameState.currentLevel.targetScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Difficulty:</span>
                  <Badge className="bg-blue-100 text-blue-700 text-xs">{gameState.currentLevel.difficulty}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rules */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal">Game Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>Drag rooms from the palette to the grid</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Connect related rooms for better flow</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <span>Avoid room overlaps</span>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span>Optimize for circulation efficiency</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-charcoal">Game Complete!</DialogTitle>
            <DialogDescription>Here's how you performed on this room flow challenge.</DialogDescription>
          </DialogHeader>
          {gameResult && (
            <div className="space-y-4">
              {/* Score Display */}
              <div className="text-center">
                <div className="text-4xl font-black text-teal-600 mb-2">{gameResult.efficiency}%</div>
                <div className="text-lg font-semibold text-charcoal mb-2">Flow Efficiency</div>
                <div className="flex justify-center gap-1 mb-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Star
                      key={i}
                      className={`w-6 h-6 ${
                        i < gameResult.stars ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <h4 className="font-semibold text-charcoal">Feedback:</h4>
                {gameResult.feedback.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-teal-600 rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm text-gray-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onGameExit}>
              Exit Game
            </Button>
            <Button onClick={handleGameComplete} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
