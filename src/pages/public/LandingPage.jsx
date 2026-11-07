import { Link } from 'react-router-dom'
import {
  GraduationCap, Shield, Building2, Users, ClipboardList,
  BarChart3, CheckCircle, ArrowRight, MapPin, CreditCard
} from 'lucide-react'

const FEATURES = [
  { icon: Shield,      title: 'District-Level Control',    desc: 'District Admins oversee and approve all organizations within their jurisdiction.' },
  { icon: Building2,   title: 'Multi-Tenant Architecture', desc: 'Each school or company operates in an isolated, secure environment.' },
  { icon: ClipboardList,title: 'Task Management',          desc: 'Assign, track, and grade tasks with deadlines and file submissions.' },
  { icon: BarChart3,   title: 'Analytics & Reporting',     desc: 'Real-time dashboards for submission rates, performance, and compliance.' },
  { icon: Users,       title: 'Role-Based Access',         desc: 'Admins, Teachers, Workers, Students, and Interns — each with the right access.' },
  { icon: CreditCard,  title: 'Subscription Management',   desc: 'Transparent pricing with monthly, quarterly, and yearly plans in RWF.' },
]

const PRICING = [
  { type: 'School',  monthly: '50,000', quarterly: '135,000', yearly: '480,000', color: 'border-primary-900' },
  { type: 'Company', monthly: '75,000', quarterly: '202,500', yearly: '720,000', color: 'border-gov-gold'    },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-900 rounded-md flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Rwanda TMS</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-primary-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-primary-900 transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-primary-900 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/parent/login" className="text-xs font-medium text-gray-600 hover:text-primary-900 px-2 py-1.5">Parent Portal</Link>
            <Link to="/login"    className="btn-secondary text-xs py-1.5 px-3">Sign In</Link>
            <Link to="/register" className="btn-primary  text-xs py-1.5 px-3">Register Organization</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-primary-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs text-blue-200 mb-6">
            <MapPin size={12} /> Built for Rwanda's Administrative Structure
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Task Management for<br />
            <span className="text-gov-gold">Schools & Companies</span>
          </h1>
          <p className="mt-5 text-blue-200 text-base max-w-2xl mx-auto leading-relaxed">
            A government-grade multi-tenant platform where District Admins oversee organizations,
            teachers assign tasks, and students submit work — all in one structured system.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link to="/register" className="btn-gold text-sm py-3 px-6 justify-center">
              Register Your Organization <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn-secondary text-sm py-3 px-6 justify-center bg-white/10 border-white/20 text-white hover:bg-white/20">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-gov-green text-white py-6 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'Districts',     value: '5'    },
            { label: 'Organizations', value: '200+' },
            { label: 'Active Users',  value: '10K+' },
            { label: 'Tasks Tracked', value: '50K+' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-gov-gold">{value}</p>
              <p className="text-emerald-200 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-6 bg-gov-light">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Everything You Need</h2>
            <p className="text-sm text-gray-500 mt-2">Designed for accountability, transparency, and efficiency</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card hover:shadow-panel transition-shadow">
                <div className="w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center mb-4">
                  <Icon size={18} className="text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Register',  desc: 'Submit your organization details and select your district' },
              { step: '02', title: 'Pay',        desc: 'Complete subscription payment (MoMo / Bank Transfer)'     },
              { step: '03', title: 'Get Approved',desc: 'District Admin reviews and approves your organization'   },
              { step: '04', title: 'Go Live',    desc: 'Receive your unique code and onboard your users'          },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-primary-900 text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3">
                  {step}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 px-6 bg-gov-light">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Transparent Pricing (RWF)</h2>
            <p className="text-sm text-gray-500 mt-2">Save up to 20% with annual plans</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PRICING.map(({ type, monthly, quarterly, yearly, color }) => (
              <div key={type} className={`card border-t-4 ${color}`}>
                <h3 className="text-base font-bold text-gray-900 mb-4">{type}</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Monthly',   value: monthly,   badge: null        },
                    { label: 'Quarterly', value: quarterly, badge: '10% off'   },
                    { label: 'Yearly',    value: yearly,    badge: '20% off'   },
                  ].map(({ label, value, badge }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{value} RWF</span>
                        {badge && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{badge}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/register" className="btn-primary w-full justify-center mt-4 text-xs">
                  Register as {type}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-primary-900 text-white text-center">
        <h2 className="text-2xl font-bold">Ready to Get Started?</h2>
        <p className="text-blue-200 text-sm mt-2 mb-6">Join hundreds of organizations already using Rwanda TMS</p>
        <Link to="/register" className="btn-gold text-sm py-3 px-8 inline-flex items-center gap-2">
          Register Your Organization <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 text-center text-xs">
        <p>© 2024 Rwanda Task Management System · Built for Rwanda's Educational and Corporate Sectors 🇷🇼</p>
      </footer>

      
    </div>
  )
}
