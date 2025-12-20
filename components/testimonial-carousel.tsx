"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Quote } from "lucide-react"

const testimonials = [
  {
    id: 1,
    text: "Design better. Build smarter.",
    author: "Architecture Philosophy",
    type: "motivational",
  },
  {
    id: 2,
    text: "Beat the AI and become an Architect Pro!",
    author: "Challenge Goal",
    type: "motivational",
  },
  {
    id: 3,
    text: "This simulator helped me understand spatial relationships like never before. The AI feedback is incredibly detailed!",
    author: "Sarah Chen, MIT Architecture",
    type: "testimonial",
  },
  {
    id: 4,
    text: "Every architect needs to think like a problem solver first.",
    author: "Design Principle",
    type: "motivational",
  },
  {
    id: 5,
    text: "The competition aspect makes learning addictive. I've improved my design scores by 40% in just two weeks!",
    author: "Marcus Rodriguez, UC Berkeley",
    type: "testimonial",
  },
  {
    id: 6,
    text: "Innovation distinguishes between a follower and a leader in architecture.",
    author: "Creative Mindset",
    type: "motivational",
  },
]

export function TestimonialCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length)
    }, 4000) // Change every 4 seconds

    return () => clearInterval(timer)
  }, [])

  const currentTestimonial = testimonials[currentIndex]

  return (
    <motion.div
      className="mb-16"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1.1 }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-charcoal mb-2">What ENARC Users Say</h2>
          <p className="text-gray-600">Inspiration and feedback from our community</p>
        </div>

        <div className="relative h-48 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTestimonial.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Card
                className={`max-w-2xl mx-auto border-2 shadow-xl ${
                  currentTestimonial.type === "motivational"
                    ? "bg-gradient-to-r from-teal-50 to-green-50 border-teal-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <CardContent className="p-8 text-center">
                  <motion.div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                      currentTestimonial.type === "motivational"
                        ? "bg-gradient-to-r from-teal-500 to-green-500"
                        : "bg-gradient-to-r from-purple-500 to-pink-500"
                    }`}
                    whileHover={{ rotate: 10, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <Quote className="w-6 h-6 text-white" />
                  </motion.div>

                  <blockquote className="text-xl md:text-2xl font-semibold text-charcoal mb-4 leading-relaxed">
                    "{currentTestimonial.text}"
                  </blockquote>

                  <cite
                    className={`text-sm font-medium ${
                      currentTestimonial.type === "motivational" ? "text-teal-600" : "text-gray-600"
                    }`}
                  >
                    — {currentTestimonial.author}
                  </cite>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-6 space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex ? "bg-teal-600 scale-125" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
