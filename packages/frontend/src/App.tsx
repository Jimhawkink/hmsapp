import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Layout
import DashboardLayout from "./layouts/DashboardLayout";
import AdminPanelLayout from "./layouts/AdminPanelLayout";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientRegistrationPage from "./pages/PatientRegistrationPage";
import EncounterListPage from "./pages/EncounterListPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import MessagingPage from "./pages/MessagingPage";
import BillingPage from "./pages/BillingPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import InvestigationPage from "./pages/InvestigationPage";
import TriageEncounterPage from "./pages/TriageEncounterPage";
import PatientEncounterPage from "./pages/PatientEncounterPage";

// ── New HMS Module Pages ───────────────────────────────────────────────────────
import PharmacyPage from "./pages/PharmacyPage";
import WardManagementPage from "./pages/WardManagementPage";
import AdmissionsPage from "./pages/AdmissionsPage";
import AdmissionDetailPage from "./pages/AdmissionDetailPage";
import LabWorklist from "./pages/LabWorklist";
import InsurancePage from "./pages/InsurancePage";
import AdminPanelPage from "./pages/AdminPanelPage";

// Admin Panel Pages
import OrganisationSettingsForm from "./pages/OrganisationSettingsForm";
import RevenueTrackingPage from "./pages/RevenueTrackingPage";
import ExpenseHistoryPage from "./pages/ExpenseHistoryPage";
import ExpenseSummaryPage from "./pages/ExpenseSummaryPage";
import StaffManagementPage from "./pages/StaffManagementPage";
import StockManagementPage from "./pages/StockManagementPage";
import SummaryDashboardPage from "./pages/SummaryDashboardPage";
import DataCompletionPage from "./pages/DataCompletionPage";

// New Component for Triage Dashboard using TriageEncounterPage
const TriageDashboard = () => {
  return (
    <div className="flex h-full">
      {/* TriageEncounterPage handling both triage and history */}
      <div className="w-full p-4 overflow-auto">
        <TriageEncounterPage />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("hms_token"));

  const handleLogin = () => {
    setToken(localStorage.getItem("hms_token"));
  };

  console.log("App rendering, token:", !!token);

  return (
    <Routes>
      {/* LOGIN PAGE */}
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

      {/* REDIRECT ROUTE FOR LOGIN */}
      <Route path="/NewDashboardLayout" element={<Navigate to="/dashboard" replace />} />

      {token ? (
        <>
          {/* DASHBOARD - Main EMR/HMIS pages */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/new" element={<PatientRegistrationPage />} />
            <Route path="encounters" element={<EncounterListPage />} />
            <Route path="schedule" element={<AppointmentsPage />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="triage" element={<TriageDashboard />} />
            <Route path="encounters/triage/:patientId" element={<PatientEncounterPage />} />
            <Route path="patient-encounter/:patientId" element={<PatientEncounterPage />} />
            <Route path="encounters/complaints/:encounterId" element={<ComplaintsPage />} />
            <Route path="encounters/investigations/:encounterId" element={<InvestigationPage />} />
            {/* ── New HMS Module Routes ─────────────────────────────────────── */}
            <Route path="pharmacy" element={<PharmacyPage />} />
            <Route path="wards" element={<WardManagementPage />} />
            <Route path="admissions" element={<AdmissionsPage />} />
            <Route path="admissions/:id" element={<AdmissionDetailPage />} />
            <Route path="lab" element={<LabWorklist />} />
            <Route path="insurance" element={<InsurancePage />} />
          </Route>

          {/* ADMIN PANEL - Settings & Management pages */}
          <Route path="/admin" element={<AdminPanelLayout />}>
            <Route index element={<OrganisationSettingsForm />} />
            <Route path="organisation-settings" element={<OrganisationSettingsForm />} />
            <Route path="revenue-tracking" element={<RevenueTrackingPage />} />
            <Route path="expenses/history" element={<ExpenseHistoryPage />} />
            <Route path="expenses/summary" element={<ExpenseSummaryPage />} />
            <Route path="staff-management" element={<StaffManagementPage />} />
            <Route path="stock-management" element={<StockManagementPage />} />
            <Route path="data-completion" element={<DataCompletionPage />} />
            <Route path="admin-panel" element={<AdminPanelPage />} />
          </Route>

          {/* Also support /dashboard/organisation-settings by rendering with AdminPanelLayout */}
          <Route path="/dashboard/organisation-settings" element={<AdminPanelLayout />}>
            <Route index element={<OrganisationSettingsForm />} />
          </Route>
          <Route path="/dashboard/summary-dashboard" element={<AdminPanelLayout />}>
            <Route index element={<SummaryDashboardPage />} />
          </Route>
          <Route path="/dashboard/revenue-tracking" element={<AdminPanelLayout />}>
            <Route index element={<RevenueTrackingPage />} />
          </Route>
          <Route path="/dashboard/staff-management" element={<AdminPanelLayout />}>
            <Route index element={<StaffManagementPage />} />
          </Route>
          <Route path="/dashboard/stock-management" element={<AdminPanelLayout />}>
            <Route index element={<StockManagementPage />} />
          </Route>
          <Route path="/dashboard/expenses/history" element={<AdminPanelLayout />}>
            <Route index element={<ExpenseHistoryPage />} />
          </Route>
          <Route path="/dashboard/expenses/summary" element={<AdminPanelLayout />}>
            <Route index element={<ExpenseSummaryPage />} />
          </Route>
          <Route path="/dashboard/data-completion" element={<AdminPanelLayout />}>
            <Route index element={<DataCompletionPage />} />
          </Route>

          {/* Catch-all when logged in */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
};

export default App;