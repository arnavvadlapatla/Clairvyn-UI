export interface User {
  id: string
  name: string
  email: string
  institution: string
  total_score: number
}

export interface Plan {
  id: string
  title: string
  faulty_plan_url: string
  ai_fix_url: string
  description: string
}

export interface Fix {
  id: string
  plan_id: string
  user_id: string
  human_fix_url: string
  score_accuracy: number
  score_design: number
  score_minimalism: number
  ai_better_areas: string[]
  human_better_areas: string[]
  timestamp: string
}

export interface GameSession {
  currentPlan: Plan | null
  currentUser: User | null
  currentFix: Fix | null
}
