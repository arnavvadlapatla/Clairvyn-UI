"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
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
  Move,
  Grid3X3,
  Zap,
  Trophy,
  Eye,
  EyeOff,
  RotateCw,
  Trash2,
  Undo,
  Volume2,
  VolumeX,
  Home,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface RoomBlock {
  id: string
  name: string
  icon: string
  area: number
  color: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number // 0, 90, 180, 270
  isPlaced: boolean
  connections: string[]
  priority: number
  category: "living" | "private" | "service" | "utility"
}

interface GameLevel {
  id: number
  title: string
  difficulty: string
  description: string
  rooms: RoomBlock[]
  gridSize: { width: number; height: number }
  hints: string[]
  timeLimit: number
  targetScore: number
  xpReward: number
}

interface PlacementHistory {
  roomId: string
  position: { x: number; y: number }
  rotation: number
  action: "place" | "move" | "rotate" | "remove"
}

interface MinecraftRoomBuilderProps {
  levelId: number
  onGameComplete: (score: number, efficiency: number, stars: number) => void
  onGameExit: () => void
}

export function MinecraftRoomBuilder({ levelId, onGameComplete, onGameExit }: MinecraftRoomBuilderProps) {
  const [currentLevel, setCurrentLevel] = useState<GameLevel | null>(null)
  const [rooms, setRooms] = useState<RoomBlock[]>([])
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [draggedRoom, setDraggedRoom] = useState<string | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isGameActive, setIsGameActive] = useState(true)
  const [showHints, setShowHints] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [placementHistory, setPlacementHistory] = useState<PlacementHistory[]>([])
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [gameResult, setGameResult] = useState<{
    score: number
    efficiency: number
    stars: number
    feedback: string[]
  } | null>(null)

  const buildMatRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Game levels with Minecraft-style progression
  const gameLevels: GameLevel[] = [
    {
      id: 1,
      title: "Starter Cabin",
      difficulty: "Beginner",
      description: "Build your first 3-room cabin layout",
      gridSize: { width: 8, height: 6 },
      timeLimit: 300,
      targetScore: 75,
      xpReward: 150,
      hints: [
        "Place the Kitchen near the Living area for easy access",
        "Keep the Bathroom private but accessible",
        "Try to create a compact, efficient layout",
      ],
      rooms: [
        {
          id: "living",
          name: "Living Room",
          icon: "🛋️",
          area: 200,
          color: "#e8f5e8",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["kitchen"],
          priority: 5,
          category: "living",
        },
        {
          id: "kitchen",
          name: "Kitchen",
          icon: "🍳",
          area: 120,
          color: "#fff2e8",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["living"],
          priority: 4,
          category: "service",
        },
        {
          id: "bathroom",
          name: "Bathroom",
          icon: "🚿",
          area: 60,
          color: "#f0f8ff",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 1 },
          rotation: 0,
          isPlaced: false,
          connections: [],
          priority: 3,
          category: "private",
        },
      ],
    },
    {
      id: 2,
      title: "Family Home",
      difficulty: "Intermediate",
      description: "Design a comfortable 5-room family layout",
      gridSize: { width: 10, height: 8 },
      timeLimit: 420,
      targetScore: 80,
      xpReward: 250,
      hints: [
        "Create separate public and private zones",
        "Connect Kitchen to both Living and Dining areas",
        "Place Bedroom away from noisy common areas",
      ],
      rooms: [
        {
          id: "living",
          name: "Living Room",
          icon: "🛋️",
          area: 240,
          color: "#e8f5e8",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 3 },
          rotation: 0,
          isPlaced: false,
          connections: ["kitchen", "dining"],
          priority: 5,
          category: "living",
        },
        {
          id: "kitchen",
          name: "Kitchen",
          icon: "🍳",
          area: 150,
          color: "#fff2e8",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["living", "dining"],
          priority: 4,
          category: "service",
        },
        {
          id: "dining",
          name: "Dining Room",
          icon: "🍽️",
          area: 120,
          color: "#f5f5dc",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["kitchen", "living"],
          priority: 3,
          category: "living",
        },
        {
          id: "bedroom",
          name: "Bedroom",
          icon: "🛏️",
          area: 180,
          color: "#f0f8ff",
          position: { x: 0, y: 0 },
          size: { width: 3, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["bathroom"],
          priority: 4,
          category: "private",
        },
        {
          id: "bathroom",
          name: "Bathroom",
          icon: "🚿",
          area: 80,
          color: "#f8f0ff",
          position: { x: 0, y: 0 },
          size: { width: 2, height: 2 },
          rotation: 0,
          isPlaced: false,
          connections: ["bedroom"],
          priority: 3,
          category: "private",
        },
      ],
    },
  ]

  // Initialize game
  useEffect(() => {
    const level = gameLevels.find((l) => l.id === levelId) || gameLevels[0]
    setCurrentLevel(level)
    setRooms(level.rooms.map((room) => ({ ...room, isPlaced: false, position: { x: 0, y: 0 } })))
    setTimeLeft(level.timeLimit)
    startTimer(level.timeLimit)

    // Initialize audio context
    if (soundEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [levelId, soundEnabled])

  const startTimer = (duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsGameActive(false)
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleTimeUp = () => {
    const result = calculateScore()
    setGameResult(result)
    setShowSubmitDialog(true)
  }

  // Sound effects
  const playSound = useCallback(
    (frequency: number, duration: number, type: "sine" | "square" | "triangle" = "sine") => {
      if (!soundEnabled || !audioContextRef.current) return

      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime)
      oscillator.type = type

      gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + duration)
    },
    [soundEnabled],
  )

  // Drag and drop handlers
  const handleDragStart = (roomId: string, event: React.DragEvent) => {
    setDraggedRoom(roomId)
    event.dataTransfer.setData("text/plain", roomId)
    playSound(440, 0.1)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()

    if (!buildMatRef.current || !currentLevel) return

    const rect = buildMatRef.current.getBoundingClientRect()
    const cellSize = 50
    const gridX = Math.floor((event.clientX - rect.left) / cellSize)
    const gridY = Math.floor((event.clientY - rect.top) / cellSize)

    if (gridX >= 0 && gridY >= 0 && gridX < currentLevel.gridSize.width && gridY < currentLevel.gridSize.height) {
      setHoveredCell({ x: gridX, y: gridY })
    } else {
      setHoveredCell(null)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    if (!currentLevel || !hoveredCell || !draggedRoom) return

    const room = rooms.find((r) => r.id === draggedRoom)
    if (!room) return

    // Check if placement is valid
    if (isValidPlacement(room, hoveredCell.x, hoveredCell.y)) {
      placeRoom(draggedRoom, hoveredCell.x, hoveredCell.y)
      playSound(660, 0.2, "triangle")
    } else {
      playSound(220, 0.3, "square")
    }

    setDraggedRoom(null)
    setHoveredCell(null)
  }

  const isValidPlacement = (room: RoomBlock, x: number, y: number): boolean => {
    if (!currentLevel) return false

    // Check bounds
    const roomWidth = room.rotation % 180 === 0 ? room.size.width : room.size.height
    const roomHeight = room.rotation % 180 === 0 ? room.size.height : room.size.width

    if (x + roomWidth > currentLevel.gridSize.width || y + roomHeight > currentLevel.gridSize.height) {
      return false
    }

    // Check overlaps
    return !rooms.some(
      (r) =>
        r.isPlaced &&
        r.id !== room.id &&
        roomsOverlap(
          { x, y, width: roomWidth, height: roomHeight },
          {
            x: r.position.x,
            y: r.position.y,
            width: r.rotation % 180 === 0 ? r.size.width : r.size.height,
            height: r.rotation % 180 === 0 ? r.size.height : r.size.width,
          },
        ),
    )
  }

  const roomsOverlap = (room1: any, room2: any): boolean => {
    return !(
      room1.x + room1.width <= room2.x ||
      room2.x + room2.width <= room1.x ||
      room1.y + room1.height <= room2.y ||
      room2.y + room2.height <= room1.y
    )
  }

  const placeRoom = (roomId: string, x: number, y: number) => {
    setRooms((prev) =>
      prev.map((room) => (room.id === roomId ? { ...room, position: { x, y }, isPlaced: true } : room)),
    )

    // Add to history
    setPlacementHistory((prev) => [
      ...prev.slice(-9),
      {
        roomId,
        position: { x, y },
        rotation: rooms.find((r) => r.id === roomId)?.rotation || 0,
        action: "place",
      },
    ])
  }

  const rotateRoom = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => (room.id === roomId ? { ...room, rotation: (room.rotation + 90) % 360 } : room)),
    )
    playSound(550, 0.15)
  }

  const removeRoom = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => (room.id === roomId ? { ...room, isPlaced: false, position: { x: 0, y: 0 } } : room)),
    )
    playSound(330, 0.2, "square")
  }

  const undoLastAction = () => {
    if (placementHistory.length === 0) return

    const lastAction = placementHistory[placementHistory.length - 1]
    removeRoom(lastAction.roomId)
    setPlacementHistory((prev) => prev.slice(0, -1))
    playSound(440, 0.15, "triangle")
  }

  const resetGame = () => {
    if (!currentLevel) return

    setRooms(
      currentLevel.rooms.map((room) => ({
        ...room,
        isPlaced: false,
        position: { x: 0, y: 0 },
        rotation: 0,
      })),
    )
    setPlacementHistory([])
    setSelectedRoom(null)
    playSound(880, 0.1)
  }

  const calculateScore = () => {
    if (!currentLevel) return { score: 0, efficiency: 0, stars: 0, feedback: [] }

    const placedRooms = rooms.filter((r) => r.isPlaced)
    const feedback: string[] = []

    if (placedRooms.length !== rooms.length) {
      feedback.push("Not all rooms were placed - complete the layout for full points")
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

    // Calculate compactness score
    const compactnessScore = calculateCompactness(placedRooms)

    // Calculate time bonus
    const timeBonus = Math.max(0, (timeLeft / currentLevel.timeLimit) * 20)

    // Final efficiency calculation
    const baseEfficiency = maxAdjacencyScore > 0 ? (adjacencyScore / maxAdjacencyScore) * 100 : 50
    const totalEfficiency = Math.min(100, baseEfficiency + compactnessScore + timeBonus)

    // Generate feedback
    if (adjacencyScore / maxAdjacencyScore > 0.8) {
      feedback.push("Excellent room connections! Great flow design.")
    } else if (adjacencyScore / maxAdjacencyScore > 0.6) {
      feedback.push("Good room placement, but some connections could be improved.")
    } else {
      feedback.push("Focus on connecting related rooms for better flow.")
    }

    if (compactnessScore > 15) {
      feedback.push("Efficient use of space - compact and well-organized!")
    }

    if (timeBonus > 10) {
      feedback.push("Speed bonus earned! Quick and efficient building.")
    }

    // Calculate stars
    let stars = 0
    if (totalEfficiency >= 90) stars = 3
    else if (totalEfficiency >= 75) stars = 2
    else if (totalEfficiency >= 60) stars = 1

    return {
      score: Math.round(totalEfficiency),
      efficiency: Math.round(totalEfficiency),
      stars,
      feedback,
    }
  }

  const areAdjacent = (room1: RoomBlock, room2: RoomBlock): boolean => {
    const r1Width = room1.rotation % 180 === 0 ? room1.size.width : room1.size.height
    const r1Height = room1.rotation % 180 === 0 ? room1.size.height : room1.size.width
    const r2Width = room2.rotation % 180 === 0 ? room2.size.width : room2.size.height
    const r2Height = room2.rotation % 180 === 0 ? room2.size.height : room2.size.width

    const r1 = {
      left: room1.position.x,
      right: room1.position.x + r1Width,
      top: room1.position.y,
      bottom: room1.position.y + r1Height,
    }
    const r2 = {
      left: room2.position.x,
      right: room2.position.x + r2Width,
      top: room2.position.y,
      bottom: room2.position.y + r2Height,
    }

    // Check if rooms share an edge
    const shareVerticalEdge =
      (r1.right === r2.left || r1.left === r2.right) && !(r1.bottom <= r2.top || r1.top >= r2.bottom)
    const shareHorizontalEdge =
      (r1.bottom === r2.top || r1.top === r2.bottom) && !(r1.right <= r2.left || r1.left >= r2.right)

    return shareVerticalEdge || shareHorizontalEdge
  }

  const calculateCompactness = (placedRooms: RoomBlock[]): number => {
    if (placedRooms.length === 0) return 0

    // Calculate bounding box
    let minX = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY

    placedRooms.forEach((room) => {
      const width = room.rotation % 180 === 0 ? room.size.width : room.size.height
      const height = room.rotation % 180 === 0 ? room.size.height : room.size.width

      minX = Math.min(minX, room.position.x)
      maxX = Math.max(maxX, room.position.x + width)
      minY = Math.min(minY, room.position.y)
      maxY = Math.max(maxY, room.position.y + height)
    })

    const boundingArea = (maxX - minX) * (maxY - minY)
    const totalRoomArea = placedRooms.reduce((sum, room) => sum + room.area, 0)

    return Math.max(0, 20 - (boundingArea / totalRoomArea) * 5)
  }

  const handleSubmit = () => {
    const result = calculateScore()
    setGameResult(result)
    setShowSubmitDialog(true)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    playSound(880, 0.5, "triangle")
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

  const getPlacementPreview = (room: RoomBlock, x: number, y: number) => {
    const width = room.rotation % 180 === 0 ? room.size.width : room.size.height
    const height = room.rotation % 180 === 0 ? room.size.height : room.size.width
    const isValid = isValidPlacement(room, x, y)

    return {
      x: x * 50,
      y: y * 50,
      width: width * 50,
      height: height * 50,
      isValid,
    }
  }

  if (!currentLevel) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading Minecraft Builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      {/* Game Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-charcoal mb-1 flex items-center gap-2">
            <Home className="w-6 h-6 text-teal-600" />
            {currentLevel.title}
          </h2>
          <p className="text-gray-600">{currentLevel.description}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="bg-white rounded-xl px-4 py-2 shadow-sm border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-4 h-4 ${timeLeft < 60 ? "text-red-500" : "text-teal-600"}`} />
              <span className="text-sm font-semibold text-charcoal">Time Left</span>
            </div>
            <div className={`text-xl font-black ${timeLeft < 60 ? "text-red-500" : "text-charcoal"}`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-gray-300 hover:bg-gray-50"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHints(!showHints)}
              className="border-teal-200 text-teal-600 hover:bg-teal-50"
            >
              {showHints ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="ml-2">Hints</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={undoLastAction}
              disabled={placementHistory.length === 0}
              className="border-gray-300 hover:bg-gray-50 bg-transparent"
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetGame}
              className="border-gray-300 hover:bg-gray-50 bg-transparent"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!rooms.every((r) => r.isPlaced)}
              className="bg-gradient-to-r from-teal-600 to-green-500 text-white font-bold shadow-lg"
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Build
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Build Mat */}
        <div className="lg:col-span-3">
          {/* Hints Panel */}
          <AnimatePresence>
            {showHints && (
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
                      Building Hints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {currentLevel.hints.map((hint, index) => (
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

          {/* Build Mat */}
          <Card className="border-2 border-gray-200 shadow-xl minecraft-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-teal-600" />
                Build Mat - Drag blocks here!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={buildMatRef}
                className="relative minecraft-grid rounded-lg overflow-hidden border-4 border-gray-400"
                style={{
                  width: currentLevel.gridSize.width * 50,
                  height: currentLevel.gridSize.height * 50,
                  background:
                    "linear-gradient(45deg, #8FBC8F 25%, #90EE90 25%, #90EE90 50%, #8FBC8F 50%, #8FBC8F 75%, #90EE90 75%)",
                  backgroundSize: "20px 20px",
                  imageRendering: "pixelated",
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragLeave={() => setHoveredCell(null)}
              >
                {/* Grid Lines */}
                <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 1 }}>
                  {/* Vertical lines */}
                  {Array.from({ length: currentLevel.gridSize.width + 1 }, (_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={i * 50}
                      y1={0}
                      x2={i * 50}
                      y2={currentLevel.gridSize.height * 50}
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Horizontal lines */}
                  {Array.from({ length: currentLevel.gridSize.height + 1 }, (_, i) => (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={i * 50}
                      x2={currentLevel.gridSize.width * 50}
                      y2={i * 50}
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="1"
                    />
                  ))}
                </svg>

                {/* Hover Preview */}
                {hoveredCell &&
                  draggedRoom &&
                  (() => {
                    const room = rooms.find((r) => r.id === draggedRoom)
                    if (!room) return null
                    const preview = getPlacementPreview(room, hoveredCell.x, hoveredCell.y)
                    return (
                      <div
                        className={`absolute border-2 border-dashed rounded ${
                          preview.isValid ? "bg-green-200 border-green-400" : "bg-red-200 border-red-400"
                        } opacity-70`}
                        style={{
                          left: preview.x,
                          top: preview.y,
                          width: preview.width,
                          height: preview.height,
                          zIndex: 5,
                        }}
                      />
                    )
                  })()}

                {/* Placed Rooms */}
                {rooms
                  .filter((room) => room.isPlaced)
                  .map((room) => {
                    const width = room.rotation % 180 === 0 ? room.size.width : room.size.height
                    const height = room.rotation % 180 === 0 ? room.size.height : room.size.width

                    return (
                      <motion.div
                        key={room.id}
                        className={`absolute minecraft-block cursor-pointer ${
                          selectedRoom === room.id ? "ring-4 ring-yellow-400" : ""
                        }`}
                        style={{
                          left: room.position.x * 50,
                          top: room.position.y * 50,
                          width: width * 50,
                          height: height * 50,
                          backgroundColor: room.color,
                          zIndex: 10,
                        }}
                        onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                        initial={{ scale: 0, rotate: 0 }}
                        animate={{
                          scale: 1,
                          rotate: selectedRoom === room.id ? 2 : 0,
                        }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-1">
                          <div className="text-2xl mb-1">{room.icon}</div>
                          <div className="text-xs font-bold text-charcoal leading-tight">{room.name}</div>
                          <div className="text-xs text-gray-600">{room.area}ft²</div>
                        </div>

                        {/* Selection Ring */}
                        {selectedRoom === room.id && (
                          <motion.div
                            className="absolute -inset-2 border-4 border-yellow-400 rounded-lg pointer-events-none"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </motion.div>
                    )
                  })}

                {/* Door Connections */}
                {rooms
                  .filter((r) => r.isPlaced)
                  .map((room) =>
                    room.connections.map((connectionId) => {
                      const connectedRoom = rooms.find((r) => r.id === connectionId && r.isPlaced)
                      if (!connectedRoom || !areAdjacent(room, connectedRoom)) return null

                      // Calculate door position
                      const r1Width = room.rotation % 180 === 0 ? room.size.width : room.size.height
                      const r1Height = room.rotation % 180 === 0 ? room.size.height : room.size.width
                      const r2Width =
                        connectedRoom.rotation % 180 === 0 ? connectedRoom.size.width : connectedRoom.size.height
                      const r2Height =
                        connectedRoom.rotation % 180 === 0 ? connectedRoom.size.height : connectedRoom.size.width

                      const r1 = {
                        left: room.position.x,
                        right: room.position.x + r1Width,
                        top: room.position.y,
                        bottom: room.position.y + r1Height,
                      }
                      const r2 = {
                        left: connectedRoom.position.x,
                        right: connectedRoom.position.x + r2Width,
                        top: connectedRoom.position.y,
                        bottom: connectedRoom.position.y + r2Height,
                      }

                      let doorX = 0,
                        doorY = 0

                      if (r1.right === r2.left) {
                        doorX = r1.right * 50 - 5
                        doorY = (Math.max(r1.top, r2.top) + Math.min(r1.bottom, r2.bottom)) * 25 - 5
                      } else if (r1.left === r2.right) {
                        doorX = r1.left * 50 - 5
                        doorY = (Math.max(r1.top, r2.top) + Math.min(r1.bottom, r2.bottom)) * 25 - 5
                      } else if (r1.bottom === r2.top) {
                        doorX = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right)) * 25 - 5
                        doorY = r1.bottom * 50 - 5
                      } else if (r1.top === r2.bottom) {
                        doorX = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right)) * 25 - 5
                        doorY = r1.top * 50 - 5
                      }

                      return (
                        <motion.div
                          key={`door-${room.id}-${connectionId}`}
                          className="absolute w-3 h-3 bg-amber-500 border-2 border-amber-600 rounded-full"
                          style={{
                            left: doorX,
                            top: doorY,
                            zIndex: 15,
                          }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3 }}
                        />
                      )
                    }),
                  )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar & Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Room Inventory */}
          <Card className="border-2 border-gray-100 shadow-lg minecraft-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal flex items-center gap-2">
                <Move className="w-5 h-5 text-teal-600" />
                Room Blocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    className={`minecraft-block cursor-move p-3 ${
                      room.isPlaced ? "opacity-50 grayscale" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: room.color }}
                    draggable={!room.isPlaced}
                    onDragStart={(e) => !room.isPlaced && handleDragStart(room.id, e)}
                    whileHover={!room.isPlaced ? { scale: 1.02 } : {}}
                    whileDrag={{ scale: 1.1, rotate: 5 }}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{room.icon}</div>
                      <div className="font-bold text-sm text-charcoal">{room.name}</div>
                      <div className="text-xs text-gray-600">{room.area} sq ft</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {room.size.width}×{room.size.height} blocks
                      </div>
                      {room.isPlaced && <Badge className="bg-green-100 text-green-700 text-xs mt-2">✓ Placed</Badge>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selected Room Controls */}
          {selectedRoom && (
            <Card className="border-2 border-yellow-200 bg-yellow-50 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-charcoal">
                  Selected: {rooms.find((r) => r.id === selectedRoom)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => rotateRoom(selectedRoom)} className="flex-1" variant="outline">
                    <RotateCw className="w-4 h-4 mr-2" />
                    Rotate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      removeRoom(selectedRoom)
                      setSelectedRoom(null)
                    }}
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-black text-teal-600">
                  {rooms.filter((r) => r.isPlaced).length}/{rooms.length}
                </div>
                <div className="text-sm text-gray-600">Blocks Placed</div>
              </div>

              <Progress value={(rooms.filter((r) => r.isPlaced).length / rooms.length) * 100} className="h-3" />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Score:</span>
                  <span className="font-semibold text-charcoal">{currentLevel.targetScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">XP Reward:</span>
                  <span className="font-semibold text-purple-600">+{currentLevel.xpReward} XP</span>
                </div>
              </div>

              {rooms.every((r) => r.isPlaced) && (
                <motion.div
                  className="text-center py-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-600 font-semibold">Ready to submit!</p>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Building Tips */}
          <Card className="border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-charcoal">Building Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <span>Drag blocks from inventory to build mat</span>
                </div>
                <div className="flex items-start gap-2">
                  <RotateCw className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>Click blocks to select, then rotate or remove</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Connect related rooms for better scores</span>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <span>Build compact layouts for efficiency bonus</span>
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
            <DialogTitle className="text-xl font-bold text-charcoal">Build Complete!</DialogTitle>
            <DialogDescription>Here's how your Minecraft-style layout performed.</DialogDescription>
          </DialogHeader>
          {gameResult && (
            <div className="space-y-4">
              {/* Score Display */}
              <div className="text-center">
                <div className="text-4xl font-black text-teal-600 mb-2">{gameResult.efficiency}%</div>
                <div className="text-lg font-semibold text-charcoal mb-2">Build Efficiency</div>
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
                <h4 className="font-semibold text-charcoal">Builder Feedback:</h4>
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
              Exit Builder
            </Button>
            <Button onClick={handleGameComplete} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Trophy className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx>{`
        .minecraft-block {
          border: 3px solid #666;
          border-top-color: #999;
          border-left-color: #999;
          border-right-color: #333;
          border-bottom-color: #333;
          image-rendering: pixelated;
          box-shadow: inset 2px 2px 4px rgba(255,255,255,0.3), inset -2px -2px 4px rgba(0,0,0,0.3);
        }
        
        .minecraft-card {
          border-style: solid;
          border-width: 3px;
          border-color: #666;
          border-top-color: #999;
          border-left-color: #999;
          border-right-color: #333;
          border-bottom-color: #333;
        }
        
        .minecraft-grid {
          image-rendering: pixelated;
          border-style: solid;
          border-color: #666;
          border-top-color: #999;
          border-left-color: #999;
          border-right-color: #333;
          border-bottom-color: #333;
        }
      `}</style>
    </div>
  )
}
