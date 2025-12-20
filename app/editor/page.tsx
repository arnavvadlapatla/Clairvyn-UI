"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CheckCircle, AlertCircle, Send } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { mockPlans } from "@/lib/mock-data"
import type { User } from "@/lib/types"

export default function EditorPage() {
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [userInfo, setUserInfo] = useState<Partial<User>>({ name: "", email: "", institution: "" })
  const router = useRouter()

  const currentPlan = mockPlans[0] // Using first plan for demo

  const errorChecklist = [
    {
      item: "Work triangle efficiency",
      status: "error",
      description: "Distance between sink, stove, and refrigerator",
    },
    { item: "Counter space adequacy", status: "error", description: 'Minimum 36" continuous counter space' },
    { item: "Appliance clearances", status: "error", description: "Proper door swing and access clearances" },
    { item: "Code compliance", status: "warning", description: "Building code and accessibility requirements" },
    { item: "Traffic flow", status: "warning", description: "Unobstructed pathways through kitchen" },
    { item: "Storage accessibility", status: "success", description: "Easy access to cabinets and pantry" },
  ]

  const instructions = [
    "Analyze the faulty floorplan for design issues",
    "Identify code violations and inefficiencies",
    "Use the 3D editor to reposition elements",
    "Ensure proper work triangle and clearances",
    "Submit your solution for AI comparison",
  ]

  const handleSubmit = () => {
    if (!userInfo.name || !userInfo.email) {
      alert("Please fill in your name and email")
      return
    }

    // Save submission data
    const submissionData = {
      userInfo,
      planId: currentPlan.id,
      timestamp: new Date().toISOString(),
    }

    localStorage.setItem("currentSubmission", JSON.stringify(submissionData))
    router.push("/results")
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "warning":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-700 bg-green-50 border-green-200"
      case "warning":
        return "text-yellow-700 bg-yellow-50 border-yellow-200"
      case "error":
        return "text-red-700 bg-red-50 border-red-200"
      default:
        return "text-gray-700 bg-gray-50 border-gray-200"
    }
  }

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
              <h1 className="text-2xl font-bold text-gray-900">{currentPlan.title}</h1>
              <p className="text-gray-600">Fix the architectural issues in this floorplan</p>
            </div>
          </div>
          <Button onClick={() => setShowSubmitDialog(true)} className="bg-teal-600 hover:bg-teal-700">
            <Send className="w-4 h-4 mr-2" />
            Submit Fix
          </Button>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Editor Area */}
          <div className="lg:col-span-3">
            {/* Plan Brief */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Challenge Brief</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{currentPlan.description}</p>
              </CardContent>
            </Card>

            {/* 3D Floorplan Viewer Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">3D Floorplan Editor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-white border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <div className="aspect-[3/2] flex items-center justify-center">
                    <img
                      src={currentPlan.faulty_plan_url || "/placeholder.svg"}
                      alt="Faulty Floorplan"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    />
                  </div>
                  <div className="absolute top-4 left-4">
                    <Badge variant="destructive">Faulty Plan</Badge>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 border">
                    <p className="text-sm text-gray-600">
                      <strong>3D Editor Integration:</strong> Three.js floorplan editor will be integrated here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3">
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-1 mt-0.5 bg-teal-50 border-teal-200 text-teal-700"
                      >
                        {index + 1}
                      </Badge>
                      <span className="text-sm text-gray-700">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Error Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Error Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorChecklist.map((item, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${getStatusColor(item.status)}`}>
                      <div className="flex items-start gap-2 mb-1">
                        {getStatusIcon(item.status)}
                        <span className="font-medium text-sm">{item.item}</span>
                      </div>
                      <p className="text-xs opacity-80 ml-6">{item.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Your Fix</DialogTitle>
            <DialogDescription>
              Provide your information to submit your solution and compare it with our AI fix.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={userInfo.name || ""}
                onChange={(e) => setUserInfo((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userInfo.email || ""}
                onChange={(e) => setUserInfo((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email"
              />
            </div>
            <div>
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                value={userInfo.institution || ""}
                onChange={(e) => setUserInfo((prev) => ({ ...prev, institution: e.target.value }))}
                placeholder="Your school or university"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-teal-600 hover:bg-teal-700">
              Submit & Compare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
