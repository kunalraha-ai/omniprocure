"use client";
import { motion } from "framer-motion"

export function TestimonialsSection() {
  return (
    <section className="py-16 px-6 bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold mb-4">What customers say</h2>
          <p className="max-w-2xl text-sm text-slate-300">
            Trusted by modern teams to accelerate workflows, streamline procurement, and deliver better buying experiences.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <motion.article
              key={index}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <p className="text-sm leading-relaxed text-slate-200 mb-6">
                “This solution helped us reduce procure-to-pay time and improve vendor coordination across every team.”
              </p>
              <div className="text-sm font-semibold">Jane Doe</div>
              <div className="text-xs text-slate-400">Head of Operations</div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
