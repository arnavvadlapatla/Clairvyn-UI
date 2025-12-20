"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Trophy,
  Medal,
  Award,
  RefreshCw,
  ArrowLeft,
  Users,
  Search,
  Filter,
  TrendingUp,
  Star,
  Crown,
  Zap,
  Target,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { getInstitutions } from "@/lib/game-data"
import type { User } from "@/lib/types"
import { EnarcLogoSmall } from "@/components/enarc-logo"

// Enhanced user data with additional gamification fields
interface EnhancedUser extends User {
  challenges_completed: number
  level: string
  streak: number
  badges: string[]
  last_active: string
  rank_change: number // +1, -1, 0 for rank movement
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<EnhancedUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<EnhancedUser[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<string>("all")
  const [selectedLevel, setSelectedLevel] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("rank")
  const [searchQuery, setSearchQuery] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId] = useState("1") // Mock current user ID

  const institutions = getInstitutions()
  const levels = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"]

  // Enhanced mock data with gamification elements
  const enhancedMockUsers: EnhancedUser[] = [
    {
      id: "1",
      name: "Sarah Chen",
      email: "s.chen@mit.edu",
      institution: "MIT Architecture",
      total_score: 2847,
      challenges_completed: 12,
      level: "Expert",
      streak: 7,
      badges: ["Speed Demon", "Perfectionist", "AI Crusher"],
      last_active: "2 hours ago",
      rank_change: 1,
    },
    {
      id: "2",
      name: "Marcus Rodriguez",
      email: "m.rodriguez@berkeley.edu",
      institution: "UC Berkeley",
      total_score: 2756,
      challenges_completed: 10,
      level: "Advanced",
      streak: 4,
      badges: ["Consistent", "Team Player"],
      last_active: "1 day ago",
      rank_change: -1,
    },
    {
      id: "3",
      name: "Emma Thompson",
      email: "e.thompson@harvard.edu",
      institution: "Harvard GSD",
      total_score: 2698,
      challenges_completed: 11,
      level: "Advanced",
      streak: 3,
      badges: ["Rising Star", "Detail Master"],
      last_active: "3 hours ago",
      rank_change: 0,
    },
    {
      id: "4",
      name: "David Kim",
      email: "d.kim@cornell.edu",
      institution: "Cornell AAP",
      total_score: 2634,
      challenges_completed: 9,
      level: "Intermediate",
      streak: 2,
      badges: ["Steady Climber"],
      last_active: "5 hours ago",
      rank_change: 2,
    },
    {
      id: "5",
      name: "Lisa Wang",
      email: "l.wang@yale.edu",
      institution: "Yale School of Architecture",
      total_score: 2589,
      challenges_completed: 8,
      level: "Intermediate",
      streak: 1,
      badges: ["Newcomer"],
      last_active: "1 day ago",
      rank_change: -1,
    },
  ]

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [selectedInstitution, selectedLevel, searchQuery, sortBy, users])

  const loadUsers = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setUsers(enhancedMockUsers)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...users]

    // Institution filter
    if (selectedInstitution !== "all") {
      filtered = filtered.filter((user) => user.institution === selectedInstitution)
    }

    // Level filter
    if (selectedLevel !== "all") {
      filtered = filtered.filter((user) => user.level === selectedLevel)
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.institution.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rank":
          return b.total_score - a.total_score
        case "name":
          return a.name.localeCompare(b.name)
        case "institution":
          return a.institution.localeCompare(b.institution)
        case "challenges":
          return b.challenges_completed - a.challenges_completed
        default:
          return b.total_score - a.total_score
      }
    })

    setFilteredUsers(filtered)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadUsers()
    setIsRefreshing(false)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return (
          <div className="w-6 h-6 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-500">#{rank}</span>
          </div>
        )
    }
  }

  const getRankChange = (change: number) => {
    if (change > 0) {
      return <ChevronUp className="w-4 h-4 text-green-500" />
    } else if (change < 0) {
      return <ChevronDown className="w-4 h-4 text-red-500" />
    }
    return <div className="w-4 h-4" />
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const getLevelBadge = (level: string) => {
    const levelColors = {
      Beginner: "bg-gray-100 text-gray-700 border-gray-300",
      Intermediate: "bg-blue-100 text-blue-700 border-blue-300",
      Advanced: "bg-purple-100 text-purple-700 border-purple-300",
      Expert: "bg-orange-100 text-orange-700 border-orange-300",
      Master: "bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-400",
    }
    return levelColors[level as keyof typeof levelColors] || levelColors["Beginner"]
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
            <p className="text-gray-600 font-medium">Loading ENARC leaderboard...</p>
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
                <h1 className="text-3xl font-black text-charcoal flex items-center gap-3">🏆 ENARC Leaderboard</h1>
                <p className="text-gray-600 font-medium">See how you rank among architecture peers worldwide</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-gray-300 bg-white/80 backdrop-blur-sm hover:bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/challenge">
              <Button className="btn-gradient text-white font-bold shadow-lg hover:shadow-xl">
                <Target className="w-4 h-4 mr-2" />
                Start Challenge
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Top Performers Podium */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-charcoal mb-2">🌟 Top Performers</h2>
            <p className="text-gray-600">This month's architecture champions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {filteredUsers.slice(0, 3).map((user, index) => {
              const rank = index + 1
              const podiumHeights = ["h-32", "h-24", "h-20"]
              const podiumColors = [
                "bg-gradient-to-t from-yellow-400 to-yellow-500",
                "bg-gradient-to-t from-gray-300 to-gray-400",
                "bg-gradient-to-t from-amber-500 to-amber-600",
              ]

              return (
                <motion.div
                  key={user.id}
                  className={`relative ${rank === 2 ? "order-first md:order-none" : ""} mt-8`}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                >
                  <Card className="relative overflow-visible border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300">
                    {/* Podium Base */}
                    <div
                      className={`absolute bottom-0 left-0 right-0 ${podiumHeights[index]} ${podiumColors[index]} opacity-10 rounded-b-lg`}
                    />

                    {/* Rank Badge - Positioned above card with proper spacing */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                      <motion.div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${
                          rank === 1
                            ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                            : rank === 2
                              ? "bg-gradient-to-r from-gray-300 to-gray-400"
                              : "bg-gradient-to-r from-amber-500 to-amber-600"
                        }`}
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      >
                        {getRankIcon(rank)}
                      </motion.div>
                    </div>

                    <CardContent className="p-6 text-center relative z-10 pt-10">
                      {/* Avatar */}
                      <Avatar className="w-16 h-16 mx-auto mb-4 border-4 border-white shadow-lg">
                        <AvatarFallback className="bg-teal-100 text-teal-600 text-lg font-bold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>

                      {/* User Info */}
                      <h3 className="font-bold text-lg text-charcoal mb-1">{user.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{user.institution}</p>

                      {/* Score */}
                      <div className="mb-3">
                        <div className="text-2xl font-black text-teal-600">{user.total_score.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">points</div>
                      </div>

                      {/* Stats */}
                      <div className="flex justify-center gap-4 text-xs text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {user.challenges_completed}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {user.streak}
                        </div>
                      </div>

                      {/* Level Badge */}
                      <Badge className={`${getLevelBadge(user.level)} font-semibold`}>{user.level}</Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          className="grid md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{filteredUsers.length}</p>
              <p className="text-sm text-gray-600">Active Students</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg">
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{filteredUsers[0]?.total_score.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-600">Top Score</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {Math.round(filteredUsers.reduce((sum, user) => sum + user.total_score, 0) / filteredUsers.length) || 0}
              </p>
              <p className="text-sm text-gray-600">Avg Score</p>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg">
            <CardContent className="p-4 text-center">
              <Star className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {Math.round(
                  filteredUsers.reduce((sum, user) => sum + user.challenges_completed, 0) / filteredUsers.length,
                ) || 0}
              </p>
              <p className="text-sm text-gray-600">Avg Challenges</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters & Search */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-charcoal flex items-center gap-2">
                <Filter className="w-5 h-5 text-teal-600" />
                Filters & Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-5 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-2 border-gray-200 focus:border-teal-500"
                  />
                </div>

                {/* Institution Filter */}
                <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-teal-500">
                    <SelectValue placeholder="All Institutions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Institutions</SelectItem>
                    {institutions.map((institution) => (
                      <SelectItem key={institution} value={institution}>
                        {institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Level Filter */}
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-teal-500">
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {levels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort By */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-teal-500">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank">Rank</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="institution">Institution</SelectItem>
                    <SelectItem value="challenges">Challenges</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedInstitution("all")
                    setSelectedLevel("all")
                    setSearchQuery("")
                    setSortBy("rank")
                  }}
                  className="border-2 border-gray-200 hover:bg-gray-50"
                >
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Leaderboard Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-2 border-gray-100 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-charcoal">
                Rankings ({filteredUsers.length} students)
                {selectedInstitution !== "all" && ` - ${selectedInstitution}`}
                {selectedLevel !== "all" && ` - ${selectedLevel} Level`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg mb-2">No students found</p>
                  <p className="text-gray-400 mb-6">
                    Try adjusting your filters or be the first to take the challenge!
                  </p>
                  <Link href="/challenge">
                    <Button className="btn-gradient text-white font-bold">
                      <Target className="w-4 h-4 mr-2" />
                      Start Challenge
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-50 z-10">
                      <TableRow className="border-b-2 border-gray-200">
                        <TableHead className="w-16 font-bold text-charcoal">Rank</TableHead>
                        <TableHead className="font-bold text-charcoal">Student</TableHead>
                        <TableHead className="font-bold text-charcoal">Institution</TableHead>
                        <TableHead className="text-right font-bold text-charcoal">Score</TableHead>
                        <TableHead className="text-center font-bold text-charcoal">Challenges</TableHead>
                        <TableHead className="text-center font-bold text-charcoal">Level</TableHead>
                        <TableHead className="text-center font-bold text-charcoal">Streak</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredUsers.map((user, index) => {
                          const rank = index + 1
                          const isCurrentUser = user.id === currentUserId

                          return (
                            <motion.tr
                              key={user.id}
                              className={`border-b border-gray-100 hover:bg-gray-50 transition-all duration-200 ${
                                isCurrentUser ? "bg-teal-50 hover:bg-teal-100" : ""
                              } ${rank <= 3 ? "bg-gradient-to-r from-yellow-50 to-orange-50" : ""}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
                              whileHover={{ scale: 1.01 }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getRankIcon(rank)}
                                  {getRankChange(user.rank_change)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-teal-100 text-teal-600 text-sm font-bold">
                                      {getInitials(user.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-semibold text-charcoal flex items-center gap-2">
                                      {user.name}
                                      {isCurrentUser && <Badge className="bg-teal-600 text-white text-xs">You</Badge>}
                                    </p>
                                    <p className="text-sm text-gray-500">{user.email}</p>
                                    {user.badges.length > 0 && (
                                      <div className="flex gap-1 mt-1">
                                        {user.badges.slice(0, 2).map((badge, i) => (
                                          <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                                            {badge}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-700 font-medium">{user.institution}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="font-bold text-xl text-charcoal">
                                  {user.total_score.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">points</div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Target className="w-4 h-4 text-teal-600" />
                                  <span className="font-semibold">{user.challenges_completed}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${getLevelBadge(user.level)} font-semibold`}>{user.level}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Zap className="w-4 h-4 text-orange-500" />
                                  <span className="font-semibold text-orange-600">{user.streak}</span>
                                </div>
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Card className="bg-gradient-to-r from-teal-600 to-green-500 border-0 shadow-2xl max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Ready to Climb the Rankings?</h3>
              <p className="text-teal-100 mb-6 text-lg">
                Challenge yourself with new architectural problems and compete with peers worldwide
              </p>
              <Link href="/challenge">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    className="bg-white text-teal-600 hover:bg-gray-50 font-bold px-8 py-3 text-lg shadow-lg"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Start New Challenge
                  </Button>
                </motion.div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
