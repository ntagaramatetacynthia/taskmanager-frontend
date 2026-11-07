import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, BookOpen, ClipboardList,
  BarChart3, CreditCard, LogOut, GraduationCap,
  Briefcase, Settings, CheckSquare
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'

const NAV = {
  district_admin: [
    { to: '/district',              icon: LayoutDashboard, label: 'Dashboard'      },
    { to: '/district/organizations',icon: Building2,       label: 'Organizations'  },
    { to: '/district/analytics',    icon: BarChart3,       label: 'Analytics'      },
    { to: '/district/payments',     icon: CreditCard,      label: 'Payments'       },
  ],
  organization_admin: [
    { to: '/org',           icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/org/users',     icon: Users,           label: 'Staff & Users'},
    { to: '/org/classes',   icon: BookOpen,        label: 'Classes'      },
    { to: '/org/analytics', icon: BarChart3,       label: 'Analytics'    },
  ],
  teacher: [
    { to: '/teacher',            icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/teacher/tasks',      icon: ClipboardList,   label: 'My Tasks'    },
    { to: '/teacher/create-task',icon: CheckSquare,     label: 'Create Task' },
    { to: '/teacher/classes',    icon: BookOpen,        label: 'Manage Classes & Students'  },
  ],
  worker: [
    { to: '/teacher',            icon: LayoutDashboard, label: 'Dashboard'   },
    { to: '/teacher/tasks',      icon: ClipboardList,   label: 'My Tasks'    },
    { to: '/teacher/create-task',icon: CheckSquare,     label: 'Create Task' },
    { to: '/teacher/classes',    icon: Briefcase,       label: 'Departments' },
  ],
  student: [
    { to: '/student',         icon: LayoutDashboard, label: 'Dashboard'  },
    { to: '/student/tasks',   icon: ClipboardList,   label: 'My Tasks'   },
    { to: '/student/results', icon: BarChart3,       label: 'My Results' },
  ],
  intern: [
    { to: '/student',         icon: LayoutDashboard, label: 'Dashboard'  },
    { to: '/student/tasks',   icon: ClipboardList,   label: 'My Tasks'   },
    { to: '/student/results', icon: BarChart3,       label: 'My Results' },
  ],
}

const ROLE_LABELS = {
  district_admin:    'District Admin',
  organization_admin:'Org Admin',
  teacher:           'Teacher',
  worker:            'Worker',
  student:           'Student',
  intern:            'Intern',
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  const { user, logout, role } = useAuth()
  const navigate = useNavigate()
  const links = NAV[role] || []

  const handleLogout = async () => {
    onClose?.()
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={clsx(
        "fixed inset-y-0 left-0 w-60 bg-sidebar-bg flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
      {/* Logo */}
      <div className="px-3 py-5 border-b border-white/20 bg-sidebar-top">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sidebar-accent rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <GraduationCap size={20} className="text-sidebar-text" />
          </div>
          <div>
            <p className="text-sidebar-text font-bold text-sm leading-tight">Rwanda TMS</p>
            <p className="text-sidebar-secondary text-xs font-medium">Task Management</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-3 py-4 border-b border-white/20 bg-sidebar-bg/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-avatar border-2 border-sidebar-accent/50 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-sidebar-accent text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sidebar-text text-sm font-semibold truncate">{user?.name || 'User'}</p>
            <p className="text-sidebar-secondary text-xs font-medium">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => onClose?.()}
            end={to.split('/').length <= 2}
            className={({ isActive }) =>
              clsx('sidebar-link', isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')
            }
          >
            <Icon size={16} />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/20 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx('sidebar-link', isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')
          }
        >
          <Settings size={16} />
          <span className="font-medium">Settings</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="sidebar-link sidebar-link-inactive w-full text-left hover:bg-red-500/25 hover:text-red-200 transition-all duration-200"
        >
          <LogOut size={16} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
    </>
  )
}
