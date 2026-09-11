import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import LandingLayout from '@/components/layouts/LandingLayout'
import { ArrowRight } from 'lucide-react'

export const Landing: React.FC = () => {
  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="w-full py-20 lg:py-32 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <span className="text-orange-500">Indian</span>{' '}
            <span className="text-slate-900 dark:text-white">Railway</span>{' '}
            <span className="text-green-600">Intelligence System</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-slate-900 dark:text-white">
            A real-time AI-driven decision-support platform for optimizing train movements across congested railway sections.
            Simulate traffic flow, resolve conflicts, predict delays, and support controllers with actionable, constraint-aware recommendations.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center">
            <Link
              to="/simulation"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-lg hover:scale-[1.02] transition-all shadow-lg"
            >
              Open Simulator
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </section>
    </LandingLayout>
  )
}

export default Landing

