import Link from "next/link"

export function GlassmorphismNav() {
  return (
    <nav className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">
          OmniProcure
        </Link>
        <div className="flex flex-wrap gap-4 text-sm text-slate-200">
          <Link href="/about" className="hover:text-white transition-colors">
            About
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
          <Link href="/features" className="hover:text-white transition-colors">
            Features
          </Link>
        </div>
      </div>
    </nav>
  )
}
