import type { User, Plan, Fix } from "./types"

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Sarah Chen",
    email: "s.chen@mit.edu",
    institution: "MIT Architecture",
    total_score: 2847,
  },
  {
    id: "2",
    name: "Marcus Rodriguez",
    email: "m.rodriguez@berkeley.edu",
    institution: "UC Berkeley",
    total_score: 2756,
  },
  {
    id: "3",
    name: "Emma Thompson",
    email: "e.thompson@harvard.edu",
    institution: "Harvard GSD",
    total_score: 2698,
  },
  {
    id: "4",
    name: "David Kim",
    email: "d.kim@cornell.edu",
    institution: "Cornell AAP",
    total_score: 2634,
  },
  {
    id: "5",
    name: "Lisa Wang",
    email: "l.wang@yale.edu",
    institution: "Yale School of Architecture",
    total_score: 2589,
  },
  {
    id: "6",
    name: "Alex Johnson",
    email: "a.johnson@mit.edu",
    institution: "MIT Architecture",
    total_score: 2512,
  },
  {
    id: "7",
    name: "Maria Garcia",
    email: "m.garcia@berkeley.edu",
    institution: "UC Berkeley",
    total_score: 2467,
  },
  {
    id: "8",
    name: "James Wilson",
    email: "j.wilson@harvard.edu",
    institution: "Harvard GSD",
    total_score: 2398,
  },
]

export const mockPlans: Plan[] = [
  {
    id: "1",
    title: "Residential Kitchen Layout Challenge",
    faulty_plan_url: "/placeholder.svg?height=400&width=600&text=Faulty+Kitchen+Plan",
    ai_fix_url: "/placeholder.svg?height=400&width=600&text=AI+Fixed+Kitchen",
    description:
      "This kitchen layout has several code violations and design flaws. The refrigerator blocks cabinet access, there's insufficient counter space near the stove, and the work triangle is inefficient. Fix these issues while maintaining functionality and aesthetic appeal.",
  },
  {
    id: "2",
    title: "Office Space Optimization Challenge",
    faulty_plan_url: "/placeholder.svg?height=400&width=600&text=Faulty+Office+Plan",
    ai_fix_url: "/placeholder.svg?height=400&width=600&text=AI+Fixed+Office",
    description:
      "This office layout suffers from poor natural light distribution, inadequate meeting spaces, and inefficient traffic flow. The workstations are cramped and there's no proper break area. Redesign for better productivity and employee wellbeing.",
  },
  {
    id: "3",
    title: "Bathroom Accessibility Challenge",
    faulty_plan_url: "/placeholder.svg?height=400&width=600&text=Faulty+Bathroom+Plan",
    ai_fix_url: "/placeholder.svg?height=400&width=600&text=AI+Fixed+Bathroom",
    description:
      "This bathroom design fails to meet accessibility standards. The door swing conflicts with fixtures, there's insufficient turning radius for wheelchairs, and grab bar placement is inadequate. Redesign to meet ADA compliance while maintaining functionality.",
  },
  {
    id: "4",
    title: "Living Room Flow Challenge",
    faulty_plan_url: "/placeholder.svg?height=400&width=600&text=Faulty+Living+Room",
    ai_fix_url: "/placeholder.svg?height=400&width=600&text=AI+Fixed+Living+Room",
    description:
      "This living room has poor furniture arrangement blocking natural pathways, inadequate lighting zones, and no clear focal point. The seating arrangement doesn't promote conversation and the TV placement causes glare issues.",
  },
]

// Game Logic Functions
export const getRandomPlan = (): Plan => {
  const randomIndex = Math.floor(Math.random() * mockPlans.length)
  return mockPlans[randomIndex]
}

export const generateDummyScores = () => {
  return {
    score_accuracy: Math.floor(Math.random() * 30) + 70, // 70-100
    score_design: Math.floor(Math.random() * 30) + 70, // 70-100
    score_minimalism: Math.floor(Math.random() * 30) + 60, // 60-90
  }
}

export const getInstitutions = (): string[] => {
  const institutions = mockUsers.map((user) => user.institution)
  return Array.from(new Set(institutions)).sort()
}

// Data Management Functions
export const saveGameSession = (session: any) => {
  localStorage.setItem("gameSession", JSON.stringify(session))
}

export const loadGameSession = () => {
  const session = localStorage.getItem("gameSession")
  return session ? JSON.parse(session) : null
}

export const saveFix = (fix: Fix) => {
  const fixes = getFixes()
  fixes.push(fix)
  localStorage.setItem("fixes", JSON.stringify(fixes))

  // Update user's total score
  updateUserScore(fix.user_id, fix.score_accuracy + fix.score_design + fix.score_minimalism)
}

export const getFixes = (): Fix[] => {
  const fixes = localStorage.getItem("fixes")
  return fixes ? JSON.parse(fixes) : []
}

export const updateUserScore = (userId: string, scoreToAdd: number) => {
  const users = getUsers()
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex !== -1) {
    users[userIndex].total_score += scoreToAdd
    localStorage.setItem("users", JSON.stringify(users))
  }
}

export const getUsers = (): User[] => {
  const stored = localStorage.getItem("users")
  if (stored) {
    return JSON.parse(stored)
  } else {
    // Initialize with mock data
    localStorage.setItem("users", JSON.stringify(mockUsers))
    return mockUsers
  }
}

export const saveUser = (user: User) => {
  const users = getUsers()
  const existingIndex = users.findIndex((u) => u.email === user.email)

  if (existingIndex !== -1) {
    users[existingIndex] = user
  } else {
    users.push(user)
  }

  localStorage.setItem("users", JSON.stringify(users))
  return user
}
