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
    faulty_plan_url: "/placeholder.svg?height=400&width=600",
    ai_fix_url: "/placeholder.svg?height=400&width=600",
    description:
      "This kitchen layout has several code violations and design flaws. The refrigerator blocks cabinet access, there's insufficient counter space near the stove, and the work triangle is inefficient. Fix these issues while maintaining functionality and aesthetic appeal.",
  },
]

export const mockFixes: Fix[] = [
  {
    id: "1",
    plan_id: "1",
    user_id: "1",
    human_fix_url: "/placeholder.svg?height=400&width=600",
    score_accuracy: 92,
    score_design: 88,
    score_minimalism: 85,
    ai_better_areas: ["Code compliance", "Accessibility standards"],
    human_better_areas: ["Creative space utilization", "Aesthetic flow", "Natural lighting optimization"],
    timestamp: "2024-01-15T10:30:00Z",
  },
]

export const getInstitutions = (): string[] => {
  const institutions = mockUsers.map((user) => user.institution)
  return Array.from(new Set(institutions)).sort()
}
