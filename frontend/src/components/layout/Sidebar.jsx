import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  GitFork,
  Building2,
  Flag,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAmlStore } from '../../store/aml.store';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/graph', icon: GitFork, label: 'Graph View' },
  { to: '/entities', icon: Building2, label: 'Entities' },
  { to: '/flags', icon: Flag, label: 'Flags & Admin' },
];

export default function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar } = useAmlStore();

  return (
    <aside
      className={`
        flex flex-col h-full bg-navy-800 border-r border-white/5 transition-all duration-300
        ${isSidebarCollapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!isSidebarCollapsed && (
          <div>
            <p className="text-sm font-bold text-white leading-tight">AML Shield</p>
            <p className="text-[10px] text-gray-500 leading-tight">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center px-2' : ''}`
            }
            title={isSidebarCollapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!isSidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-4">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all duration-200 text-xs"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
