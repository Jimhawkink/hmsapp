import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { 
  FiSettings, 
  FiPieChart, 
  FiBarChart,   // ✅ Changed here
  FiDollarSign,
  FiTrendingUp,
  FiDatabase,
  FiUsers,
  FiFolder,
  FiChevronDown,
  FiChevronLeft,
  FiArrowLeft
} from "react-icons/fi";


export default function AdminPanelLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [facilityOpen, setFacilityOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(true);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 my-1 rounded-lg transition-colors ${
      isActive
        ? "bg-blue-100 text-blue-700 border-r-4 border-blue-700"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Admin Panel Sidebar */}
      <aside className={`bg-white border-r transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Sidebar Toggle + Back to Dashboard */}
        <div className="p-4 border-b flex items-center justify-between">
          {!sidebarCollapsed && (
            <NavLink 
              to="/dashboard" 
              className="flex items-center text-slate-600 hover:text-slate-800"
            >
              <FiArrowLeft className="w-4 h-4 mr-2" />
              Back to EMR/HMIS
            </NavLink>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FiChevronLeft className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Admin Navigation */}
        {sidebarCollapsed ? (
          /* Collapsed: Icons only */
          <nav className="p-2 flex flex-col items-center gap-1">
            <NavLink to="/dashboard" className="p-3 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors" title="Back to EMR/HMIS">
              <FiArrowLeft className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/organisation-settings" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Organisation Settings">
              <FiSettings className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/summary-dashboard" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Summary Dashboard">
              <FiBarChart className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/revenue-tracking" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Revenue Tracking">
              <FiTrendingUp className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/stock-management" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Stock Management">
              <FiFolder className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/staff-management" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Staff Management">
              <FiUsers className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/data-completion" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Data Completion">
              <FiDatabase className="h-5 w-5" />
            </NavLink>
            <NavLink to="/dashboard/expenses/history" className={({ isActive }) => `p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} title="Expenses">
              <FiDollarSign className="h-5 w-5" />
            </NavLink>
          </nav>
        ) : (
          /* Expanded: Full sidebar */
          <nav className="p-4 overflow-y-auto flex-1">
            <NavLink to="/dashboard/organisation-settings" className={linkClass}>
              <FiSettings className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Organisation Settings</span>
            </NavLink>

            <NavLink to="/dashboard/facility-dashboard" className={linkClass}>
              <FiPieChart className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Facility dashboard</span>
            </NavLink>

            <div className="mt-4">
              <button
                onClick={() => setFacilityOpen(!facilityOpen)}
                className="flex items-center w-full px-4 py-2 text-slate-500 text-sm font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <FiPieChart className="h-4 w-4 mr-2" />
                <span>Facility Dashboard</span>
                <FiChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${facilityOpen ? '' : '-rotate-90'}`} />
              </button>
              {facilityOpen && (
                <>
                  <NavLink to="/dashboard/summary-dashboard" className={linkClass}>
                    <FiBarChart className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Summary dashboard</span>
                  </NavLink>
                  <NavLink to="/dashboard/revenue-tracking" className={linkClass}>
                    <FiTrendingUp className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Revenue tracking</span>
                  </NavLink>
                  <NavLink to="/dashboard/data-completion" className={linkClass}>
                    <FiDatabase className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Data completion</span>
                  </NavLink>
                </>
              )}
            </div>

            <div className="mt-4">
              <button
                onClick={() => setInventoryOpen(!inventoryOpen)}
                className="flex items-center w-full px-4 py-2 text-slate-500 text-sm font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <span>Inventory</span>
                <FiChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${inventoryOpen ? '' : '-rotate-90'}`} />
              </button>
              {inventoryOpen && (
                <NavLink to="/dashboard/stock-management" className={linkClass}>
                  <FiFolder className="h-5 w-5 flex-shrink-0" />
                  <span className="ml-3">Stock management</span>
                </NavLink>
              )}
            </div>

            <NavLink to="/dashboard/staff-management" className={linkClass}>
              <FiUsers className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Staff Management</span>
            </NavLink>

            <NavLink to="/dashboard/branch-management" className={linkClass}>
              <FiFolder className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Branch management</span>
            </NavLink>

            {/* ── New Admin Modules ─────────────────────────────────────────── */}
            <NavLink to="/admin/admin-panel" className={linkClass}>
              <FiSettings className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">Admin Panel</span>
            </NavLink>

            <div className="mt-4">
              <button
                onClick={() => setExpensesOpen(!expensesOpen)}
                className="flex items-center w-full px-4 py-2 text-slate-500 text-sm font-medium hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                <span>Expenses</span>
                <FiChevronDown className={`ml-auto h-4 w-4 transition-transform duration-200 ${expensesOpen ? '' : '-rotate-90'}`} />
              </button>
              {expensesOpen && (
                <>
                  <NavLink to="/dashboard/expenses/history" className={linkClass}>
                    <FiBarChart className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Expense history</span>
                  </NavLink>
                  <NavLink to="/dashboard/expenses/summary" className={linkClass}>
                    <FiDollarSign className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3">Expense summary</span>
                  </NavLink>
                </>
              )}
            </div>
          </nav>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Main Content */}
        <main className="p-6 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
