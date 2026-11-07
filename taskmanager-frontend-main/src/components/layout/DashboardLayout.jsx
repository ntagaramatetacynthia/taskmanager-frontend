import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function DashboardLayout({ title, subtitle, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gov-light">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <Topbar
        title={title}
        subtitle={subtitle}
        onMobileMenuToggle={() => setMobileMenuOpen(v => !v)}
        isMobileMenuOpen={mobileMenuOpen}
      />
      <main className="ml-0 md:ml-60 pt-14 min-h-screen transition-all duration-200">
        <div className="p-3 sm:p-4 md:p-6 w-full max-w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
