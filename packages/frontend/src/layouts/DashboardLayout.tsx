import React, { useMemo, useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

function getDisplayName() {
  try {
    const raw = localStorage.getItem("hms_user");
    const u = raw ? JSON.parse(raw) : null;
    return u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "User";
  } catch {
    return "User";
  }
}

function getInitialsFromName(name: string) {
  const ignore = ["dr", "mr", "mrs", "ms", "prof", "doctor"];
  const parts = name.split(/\s+/).filter(Boolean).filter((p) => !ignore.includes(p.toLowerCase()));
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase() || "U";
}

// Sidebar Component
function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const [orgName, setOrgName] = useState("Kings Well Being");

  useEffect(() => {
    const fetchOrgName = async () => {
      try {
        const token = localStorage.getItem("hms_token");
        if (!token) return;
        const res = await axios.get("/api/organisation-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const name = res.data?.organisation_name || res.data?.name;
        if (name) setOrgName(name);
      } catch {
        // Keep default
      }
    };
    fetchOrgName();
  }, []);

  const menuItems = [
    { to: "/dashboard", icon: "📊", label: "Dashboard", end: true },
    { to: "/dashboard/patients", icon: "👥", label: "Patients" },
    { to: "/dashboard/encounters", icon: "📋", label: "Encounters" },
    { to: "/dashboard/schedule", icon: "📅", label: "Schedule" },
    { to: "/dashboard/triage", icon: "🩺", label: "Triage" },
    { to: "/dashboard/messaging", icon: "💬", label: "Messages" },
    { to: "/dashboard/billing", icon: "💳", label: "Billing" },
    { to: "/dashboard/payments", icon: "💰", label: "Payments" },
    { to: "/dashboard/reports", icon: "📈", label: "Reports" },
    // ── Clinical Modules ──────────────────────────────────────────────────────
    { to: "/dashboard/pharmacy", icon: "💊", label: "Pharmacy" },
    { to: "/dashboard/lab", icon: "🔬", label: "Laboratory" },
    // ── Inpatient ─────────────────────────────────────────────────────────────
    { to: "/dashboard/wards", icon: "🛏️", label: "Wards" },
    { to: "/dashboard/admissions", icon: "🏥", label: "Admissions" },
    // ── Finance & Insurance ───────────────────────────────────────────────────
    { to: "/dashboard/insurance", icon: "🛡️", label: "Insurance" },
    // ── Settings ──────────────────────────────────────────────────────────────
    { to: "/dashboard/organisation-settings", icon: "⚙️", label: "Settings", end: true },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 px-4 py-3 my-1 rounded-xl transition-all duration-300 relative ${isActive
      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    } ${expanded ? "" : "justify-center px-3"}`;

  return (
    <aside
      className={`bg-white border-r border-slate-100 transition-all duration-300 ease-out flex flex-col shadow-xl ${expanded ? "w-72" : "w-20"
        }`}
    >
      {/* Logo Header */}
      <div className={`flex items-center p-5 border-b border-slate-100 ${!expanded ? "justify-center p-4" : "justify-between"}`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-2xl">🏥</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
          </div>

          <div className={`overflow-hidden transition-all duration-300 ${expanded ? "w-auto opacity-100" : "w-0 opacity-0"}`}>
            <h1 className="font-bold text-slate-900 text-lg whitespace-nowrap">{orgName}</h1>
            <p className="text-xs text-slate-500 whitespace-nowrap">Healthcare System</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-300 ${!expanded ? "hidden" : ""}`}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      </div>
      {/* Expand button when collapsed */}
      {!expanded && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className={`text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-4 ${!expanded && "hidden"}`}>
          Menu
        </div>
        {menuItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} end={item.end}>
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            <span className={`font-medium text-sm whitespace-nowrap transition-all duration-300 ${expanded ? "opacity-100" : "hidden"}`}>
              {item.label}
            </span>

            {/* Tooltip for collapsed */}
            {!expanded && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-nowrap">
                {item.label}
                <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-full border-4 border-transparent border-r-slate-900" />
              </div>
            )}
          </NavLink>
        ))}
      </nav>

    </aside>
  );
}

// Header Component
function Header({ onSignOut }: { onSignOut: () => void }) {
  const displayName = useMemo(() => getDisplayName(), []);
  const initials = useMemo(() => getInitialsFromName(displayName), [displayName]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 h-16 flex justify-between items-center sticky top-0 z-40">
      {/* Search */}
      <div className="relative max-w-md w-full">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
        <input
          type="text"
          placeholder="Search patients, records..."
          className="pl-12 pr-4 py-2.5 border border-slate-200 rounded-xl w-full bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-sm"
        />
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Time Display */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
          <span className="text-lg">🕐</span>
          <span className="text-sm font-medium text-slate-700">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
          <span className="text-xl">🔔</span>
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        </button>

        {/* Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <button
            onClick={onSignOut}
            className="p-2.5 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
            title="Sign out"
          >
            <span className="text-lg">🚪</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// Main Layout
export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const isTriageRoute = location.pathname.startsWith("/dashboard/triage");

  const logout = () => {
    localStorage.removeItem("hms_token");
    localStorage.removeItem("hms_user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {!isTriageRoute && <Sidebar expanded={expanded} onToggle={() => setExpanded(!expanded)} />}
      <div className="flex-1 flex flex-col min-w-0">
        {!isTriageRoute && <Header onSignOut={logout} />}
        <main className={`flex-1 overflow-auto ${isTriageRoute ? "" : "p-6"}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}