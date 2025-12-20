"use client"

import { motion } from "framer-motion"
import { Heart } from "lucide-react"
import Link from "next/link"
import { EnarcLogoSmall } from "@/components/enarc-logo"

export function Footer() {
  return (
    <footer className="bg-charcoal-950 text-white py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Logo and Description */}
            <div className="md:col-span-1">
              <motion.div
                className="flex items-center gap-3 mb-4"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <EnarcLogoSmall size={40} />
                <span className="text-xl font-bold">ENARC</span>
              </motion.div>
              <p className="text-gray-400 leading-relaxed">
                Empowering the next generation of architects through AI-powered challenges and competitive learning with
                ENARC.
              </p>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-1">
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-3">
                {[
                  { name: "About", href: "/about" },
                  { name: "Contact", href: "/contact" },
                  { name: "Privacy Policy", href: "/privacy" },
                  { name: "Terms of Service", href: "/terms" },
                ].map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-teal-400 transition-colors duration-300 flex items-center group"
                    >
                      <span className="group-hover:translate-x-1 transition-transform duration-300">{link.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Connect */}
            <div className="md:col-span-1">
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <p className="text-gray-400 mb-4">Join our community of architecture students and professionals.</p>
              <div className="flex space-x-4">
                {["Twitter", "LinkedIn", "Discord"].map((platform) => (
                  <motion.a
                    key={platform}
                    href="#"
                    className="w-10 h-10 bg-gray-800 hover:bg-teal-600 rounded-lg flex items-center justify-center transition-colors duration-300"
                    whileHover={{ scale: 1.1, y: -2 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <span className="text-sm font-semibold">{platform[0]}</span>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-2 text-gray-400 mb-4 md:mb-0">
                <span>Made with</span>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                >
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
                </motion.div>
                <span>by</span>
                <span className="text-teal-400 font-semibold">Clairvyn Studios</span>
              </div>

              <div className="text-gray-400 text-sm">© 2025 ENARC. All rights reserved.</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
