// packages/frontend/src/pages/TriageEncounterPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ComplaintsPage from './ComplaintsPage';
import InvestigationPage from './InvestigationPage';
import DiagnosisAndPlan from '../components/encounter/DiagnosisAndPlan';
import PrescriptionForm from '../components/encounter/PrescriptionForm';
import ReviewOfSystems from '../components/encounter/ReviewOfSystems';
import MedicationHistory from '../components/encounter/MedicationHistory';
import PhysicalExamination from '../components/encounter/PhysicalExamination';
import EncounterAppointment from '../components/encounter/EncounterAppointment';
import PatientBills from '../components/encounter/PatientBills';
import StructuredVisitForms from '../components/encounter/StructuredVisitForms';

// Use the shared frontend types
import { LabRequest, LabResult, LabType } from "../types/investigation";

function getDisplayName() {
  try {
    const raw = localStorage.getItem("hms_user");
    const u = raw ? JSON.parse(raw) : null;
    return u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "Administrator";
  } catch {
    return "Administrator";
  }
}

function getInitialsFromName(name: string) {
  const ignore = ["dr", "mr", "mrs", "ms", "prof", "doctor"];
  const parts = name.split(/\s+/).filter(Boolean).filter((p) => !ignore.includes(p.toLowerCase()));
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase() || "AA";
}

// ----- Types -----
// keep triage/patient shapes as you had them
interface TriageEntry {
  id: number;
  patient_id: number;
  patient_status: string;
  temperature: string;
  heart_rate: string;
  blood_pressure: string;
  respiratory_rate: string;
  blood_oxygenation: string;
  weight: string;
  height: string;
  muac: string;
  lmp_date: string;
  comments: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  Patient?: {
    id: number;
    firstName: string;
    lastName: string;
    patientNumber: string;
  };
}

interface Patient {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: string;
  dob: string;
  patientStatus?: string;
  phone: string;
  email?: string;
  occupation?: string;
  heardAboutFacility?: string;
  patientNumber?: string;
  shaNumber?: string;
  county?: string;
  subCounty?: string;
  areaOfResidence?: string;
  nextOfKinFirstName?: string;
  nextOfKinLastName?: string;
  nextOfKinPhone?: string;
  createdAt: string;
  updatedAt: string;
}

interface TriageData {
  patientStatus: string;
  temperature: string;
  heartRate: string;
  bloodPressure: string;
  respiratoryRate: string;
  bloodOxygenation: string;
  weight: string;
  height: string;
  muac: string;
  lmpDate: string;
  comments: string;
}

// ----- Component -----
const TriageEncounterPage: React.FC = () => {
  const navigate = useNavigate();

  const [triageData, setTriageData] = useState<TriageData>({
    patientStatus: "",
    temperature: "",
    heartRate: "",
    bloodPressure: "",
    respiratoryRate: "",
    bloodOxygenation: "",
    weight: "",
    height: "",
    muac: "",
    lmpDate: "",
    comments: "",
  });

  const [triageHistory, setTriageHistory] = useState<TriageEntry[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeTab, setActiveTab] = useState('Triage');
  const [activeSection, setActiveSection] = useState('Triage');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [latestTriage, setLatestTriage] = useState<TriageEntry | null>(null);
  const [isPatientOverviewVisible, setIsPatientOverviewVisible] = useState(true);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const displayName = getDisplayName();
  const userInitials = getInitialsFromName(displayName);

  // New state: lab requests and results (use shared types)
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labResultsMap, setLabResultsMap] = useState<Record<number, LabResult[]>>({});

  // Cast InvestigationPage to any to allow passing extra props (labRequests/labResultsMap)
  // Reason: in some setups the InvestigationPage exported prop type doesn't include those optional props
  // even though the component accepts them at runtime. Casting avoids a TS compile error while leaving runtime behavior intact.
  const InvestigationPageAny = InvestigationPage as any;

  // Load patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- API helpers ---
  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/patients");
      if (res.ok) {
        const data = await res.json();
        setPatients(Array.isArray(data) ? data : data.patients ?? data);
      } else {
        console.warn("fetchPatients failed", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    }
  };

  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : data.patients ?? data);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (err) {
      console.error("Failed to search patients:", err);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    searchPatients(q);
  };

  // Called when a patient is chosen from search
  const handlePatientSelect = async (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setShowSearchResults(false);
    setIsPatientOverviewVisible(true);
    setLabRequests([]);
    setLabResultsMap({});

    // Get latest encounter for the patient
    try {
      const res = await fetch(`/api/encounters?patientId=${patient.id}`);
      if (res.ok) {
        const data = await res.json();
        // If backend returns array of encounters, take first/latest
        const latestEncounter = Array.isArray(data) ? (data.length > 0 ? data[0].id : null) : (data?.id ?? null);
        setEncounterId(latestEncounter ? String(latestEncounter) : `${patient.id}_new`);
        if (latestEncounter) {
          await fetchInvestigationsForEncounter(latestEncounter);
        } else {
          setLabRequests([]);
          setLabResultsMap({});
        }
      } else {
        setEncounterId(`${patient.id}_new`);
      }
    } catch (err) {
      console.error("Failed to fetch encounter ID:", err);
      setEncounterId(`${patient.id}_new`);
    }

    // Load triage history for selected patient
    await fetchTriageHistory(patient.id);
  };

  const fetchTriageHistory = async (patientId: number) => {
    try {
      const res = await fetch(`/api/triage?patientId=${patientId}`);
      if (res.ok) {
        const data = await res.json();
        const triageArray: TriageEntry[] = Array.isArray(data) ? data : data.data ?? data;
        const sorted = triageArray.sort((a, b) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return db - da;
        });
        setTriageHistory(sorted);
        setLatestTriage(sorted.length > 0 ? sorted[0] : null);
      } else {
        setTriageHistory([]);
        setLatestTriage(null);
      }
    } catch (err) {
      console.error("Failed to fetch triage history:", err);
      setTriageHistory([]);
      setLatestTriage(null);
    }
  };

  // ----- NEW: fetch investigations + results for an encounter -----
  // normalizes backend shapes into the frontend LabRequest/LabResult types
  const normalizeLabType = (v: any): LabType => {
    if (!v) return null;
    const s = String(v).toLowerCase();
    return s === "imaging" ? "imaging" : s === "laboratory" ? "laboratory" : null;
  };

  const fetchInvestigationsForEncounter = async (encId: number) => {
    try {
      // 1) fetch requests for encounter
      const reqRes = await fetch(`/api/investigation-requests?encounterId=${encId}`);
      if (!reqRes.ok) {
        console.warn("No investigation requests endpoint or none found", reqRes.status);
        setLabRequests([]);
        setLabResultsMap({});
        return;
      }

      const reqData = await reqRes.json();
      const rawRequests: any[] = Array.isArray(reqData) ? reqData : reqData.requests ?? reqData.data ?? [];

      // Map to LabRequest shape and normalize type field
      const requests: LabRequest[] = rawRequests.map((r: any) => ({
        id: Number(r.id),
        encounter_id: r.encounter_id ? Number(r.encounter_id) : encId,
        test_id: r.test_id ?? null,
        test_name: r.test_name ?? null,
        department: r.department ?? null,
        type: normalizeLabType(r.type),
        status: r.status ?? null,
        request_notes: r.request_notes ?? null,
        requested_by: r.requested_by ?? null,
        date_requested: r.date_requested ?? r.createdAt ?? null,
        createdAt: r.createdAt ?? null,
        updatedAt: r.updatedAt ?? null,
        test: r.test ?? null,
        results: r.results ?? null,
        custom_name: r.test_name ?? r.custom_name ?? null,
      }));

      setLabRequests(requests);

      // 2) for each request try to fetch results (parallel)
      const resultsMap: Record<number, LabResult[]> = {};
      await Promise.all(
        requests.map(async (r) => {
          // try direct endpoint first
          try {
            const r1 = await fetch(`/api/investigation-requests/${r.id}/results`);
            if (r1.ok) {
              const d1 = await r1.json();
              const arr: LabResult[] = Array.isArray(d1) ? d1 : d1.results ?? d1.data ?? [];
              resultsMap[r.id] = arr;
              return;
            }
          } catch (err) {
            // continue to fallback
          }

          // fallback: query investigation-results by requestId
          try {
            const r2 = await fetch(`/api/investigation-results?requestId=${r.id}`);
            if (r2.ok) {
              const d2 = await r2.json();
              const arr: LabResult[] = Array.isArray(d2) ? d2 : d2.results ?? d2.data ?? [];
              resultsMap[r.id] = arr;
              return;
            }
          } catch (err) {
            // continue
          }

          // fallback: fetch all results and filter (last resort)
          try {
            const r3 = await fetch(`/api/investigation-results`);
            if (r3.ok) {
              const d3 = await r3.json();
              const arrAll: LabResult[] = Array.isArray(d3) ? d3 : d3.results ?? d3.data ?? [];
              resultsMap[r.id] = arrAll.filter((x: any) => Number(x.request_id) === Number(r.id));
              return;
            }
          } catch (err) {
            // ignore
          }

          // else empty
          resultsMap[r.id] = [];
        })
      );

      setLabResultsMap(resultsMap);
    } catch (err) {
      console.error("Failed to fetch investigations/results for encounter:", err);
      setLabRequests([]);
      setLabResultsMap({});
    }
  };

  // ----- Save triage reading -----
  const handleSave = async () => {
    if (!selectedPatient) {
      setSaveMessage({ type: 'error', message: "Please select a patient first" });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...triageData,
          patient_id: selectedPatient.id,
          date: new Date().toISOString(),
          encounter_id: encounterId
        })
      });

      if (res.ok) {
        setSaveMessage({ type: 'success', message: "Triage data saved successfully!" });
        setTriageData({
          patientStatus: "",
          temperature: "",
          heartRate: "",
          bloodPressure: "",
          respiratoryRate: "",
          bloodOxygenation: "",
          weight: "",
          height: "",
          muac: "",
          lmpDate: "",
          comments: "",
        });
        await fetchTriageHistory(selectedPatient.id);
        if (encounterId && !String(encounterId).includes("_new")) {
          await fetchInvestigationsForEncounter(Number(encounterId));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save triage data");
      }
    } catch (err: any) {
      console.error("Failed to save triage data:", err);
      setSaveMessage({ type: 'error', message: err?.message ?? "Failed to save triage data" });
    } finally {
      setIsSaving(false);
    }
  };

  // ----- little utilities -----
  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateWeeksSinceLMP = (lmpDate: string) => {
    if (!lmpDate) return "Not recorded";
    const lastPeriod = new Date(lmpDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastPeriod.getTime());
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return `${diffWeeks} weeks ago (${formatDate(lmpDate)})`;
  };

  const calculateBMI = (weight: string, height: string) => {
    if (!weight || !height || isNaN(parseFloat(weight)) || isNaN(parseFloat(height))) return "Not recorded";
    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height) / 100;
    const bmi = weightNum / (heightNum * heightNum);
    let category = "";
    if (bmi < 18.5) category = " L";
    else if (bmi > 25) category = " H";
    return `${bmi.toFixed(1)}${category}`;
  };

  const toggleSidebar = () => setIsSidebarCollapsed(s => !s);

  // ----- Sidebar config (unchanged) -----
  const sidebarItems = [
    { id: 'triage', label: 'Triage', icon: '📋', component: 'Triage' },
    { id: 'complaints', label: 'Complaints & HPI', icon: '💬', component: 'Complaints' },
    { id: 'structured', label: 'Structured visit forms', icon: '📝', component: 'StructuredVisitForms' },
    { id: 'review', label: 'Review of systems', icon: '🔍', component: 'ReviewOfSystems' },
    { id: 'medication', label: 'Medication history', icon: '💊', component: 'MedicationHistory' },
    { id: 'examination', label: 'Examination', icon: '🩺', component: 'Examination' },
    {
      id: 'investigation',
      label: 'Investigation',
      icon: '🔬',
      hasDropdown: true,
      subItems: [
        { id: 'laboratory', label: 'Laboratory', component: 'Laboratory' },
        { id: 'imaging', label: 'Imaging', component: 'Imaging' },
      ]
    },
    { id: 'diagnosis', label: 'Diagnosis and Plan', icon: '📋', component: 'DiagnosisAndPlan' },
    { id: 'prescription', label: 'Prescription', icon: '💊', component: 'Prescription' },
    { id: 'schedule', label: 'Appointment schedule', icon: '📅', component: 'AppointmentSchedule' },
    { id: 'bills', label: 'Patient bills', icon: '💰', component: 'PatientBills' },
    { id: 'close', label: 'Close encounter', icon: '✅', component: 'CloseEncounter' }
  ];

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState<{ [key: string]: boolean }>({});
  const toggleDropdown = (id: string) => setIsDropdownOpen(p => ({ ...p, [id]: !p[id] }));
  const linkClass = (isActive: boolean) =>
    `relative flex items-center px-4 py-2 my-1 rounded-lg transition-colors ${isActive
      ? "bg-blue-100 text-blue-700"
      : "text-slate-600 hover:bg-slate-100"
    }`;

  // Render main content
  const renderContent = () => {
    if (!selectedPatient) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">👨‍⚕️</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Select a Patient</h2>
          <p className="text-gray-500">Search for a patient above to begin triage</p>
        </div>
      );
    }

    switch (activeSection) {
      case 'Triage':
        return (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Triage - {selectedPatient.firstName} {selectedPatient.lastName}</h1>
                <p className="text-gray-600">
                  {selectedPatient.gender} • {calculateAge(selectedPatient.dob)} years • DOB: {formatDate(selectedPatient.dob)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedPatient(null);
                  setSearchQuery("");
                  setTriageHistory([]);
                  setLatestTriage(null);
                  setIsPatientOverviewVisible(true);
                  setEncounterId(null);
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Change Patient
              </button>
            </div>

            {saveMessage && (
              <div className={`mb-4 p-3 rounded ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                {saveMessage.message}
              </div>
            )}

            {/* Triage inputs (same structure as your previous UI) */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Patient status</label>
                <select
                  value={triageData.patientStatus}
                  onChange={(e) => setTriageData({ ...triageData, patientStatus: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select option</option>
                  <option value="Stable">Stable</option>
                  <option value="Critical">Critical</option>
                  <option value="Unstable">Unstable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Temperature (°C)</label>
                <input type="number" step="0.1" value={triageData.temperature} onChange={(e) => setTriageData({ ...triageData, temperature: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Heart rate (bpm)</label>
                <input type="number" value={triageData.heartRate} onChange={(e) => setTriageData({ ...triageData, heartRate: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Blood pressure (mmHg)</label>
                <input type="text" placeholder="120/80" value={triageData.bloodPressure} onChange={(e) => setTriageData({ ...triageData, bloodPressure: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Respiratory rate (bpm)</label>
                <input type="number" value={triageData.respiratoryRate} onChange={(e) => setTriageData({ ...triageData, respiratoryRate: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Blood oxygenation (%)</label>
                <input type="number" min={0} max={100} value={triageData.bloodOxygenation} onChange={(e) => setTriageData({ ...triageData, bloodOxygenation: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                <input type="number" step="0.1" value={triageData.weight} onChange={(e) => setTriageData({ ...triageData, weight: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Height (cm)</label>
                <input type="number" step="0.1" value={triageData.height} onChange={(e) => setTriageData({ ...triageData, height: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">MUAC (cm)</label>
                <input type="number" step="0.1" value={triageData.muac} onChange={(e) => setTriageData({ ...triageData, muac: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">LMP</label>
                <input type="date" value={triageData.lmpDate} onChange={(e) => setTriageData({ ...triageData, lmpDate: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-600 mb-1">Comments</label>
              <textarea value={triageData.comments} onChange={(e) => setTriageData({ ...triageData, comments: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500" rows={3} />
            </div>

            <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 focus:outline-none disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save readings'}
            </button>

            {/* Triage history (unchanged) */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Triage history</h3>
                <div className="flex space-x-2">
                  <button onClick={() => selectedPatient && fetchTriageHistory(selectedPatient.id)} className="p-1 hover:bg-gray-100 rounded" title="Refresh">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {triageHistory.length > 0 ? (
                <div className="border border-gray-200 rounded">
                  {triageHistory.map((entry) => (
                    <div key={entry.id} className="border-b border-gray-100 p-4 last:border-b-0">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium">{formatDate(entry.date)}</span>
                        <span className={`text-xs px-2 py-1 rounded ${entry.patient_status === 'Stable' ? 'bg-green-100 text-green-800' : entry.patient_status === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {entry.patient_status}
                        </span>
                      </div>
                      {entry.lmp_date && (
                        <div className="mt-2 text-sm">
                          <span className="text-xs text-gray-500">LMP</span>
                          <p>{calculateWeeksSinceLMP(entry.lmp_date)}</p>
                        </div>
                      )}
                      {entry.comments && (
                        <div className="mt-2 text-sm">
                          <span className="text-xs text-gray-500">Comments</span>
                          <p className="text-gray-600">{entry.comments}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-gray-200 rounded p-8 text-center">
                  <p className="text-gray-500">No triage has been taken for this patient</p>
                </div>
              )}
            </div>
          </>
        );

      case 'Complaints':
        return <ComplaintsPage />;

      case 'StructuredVisitForms':
        return <StructuredVisitForms encounterId={encounterId || ''} patientId={selectedPatient?.id} />;

      case 'ReviewOfSystems':
        return <ReviewOfSystems encounterId={encounterId || ''} />;

      case 'MedicationHistory':
        return <MedicationHistory encounterId={encounterId || ''} patientId={selectedPatient?.id} />;

      case 'Examination':
        return <PhysicalExamination encounterId={encounterId || ''} />;

      case 'Laboratory':
      case 'Imaging':
        if (!encounterId) {
          return <div className="text-center py-12 text-red-600">No encounter ID available. Please select a patient.</div>;
        }
        return (
          <InvestigationPageAny
            encounterId={encounterId}
            activeTab={activeSection}
            labRequests={labRequests}
            labResultsMap={labResultsMap}
            refreshInvestigations={() => encounterId && !String(encounterId).includes("_new") && fetchInvestigationsForEncounter(Number(encounterId))}
          />
        );

      case 'DiagnosisAndPlan':
        return <DiagnosisAndPlan encounterId={encounterId || ''} />;

      case 'Prescription':
        return <PrescriptionForm encounterId={encounterId || ''} patientId={selectedPatient?.id} />;

      case 'AppointmentSchedule':
        return <EncounterAppointment encounterId={encounterId || ''} patientId={selectedPatient?.id} />;

      case 'PatientBills':
        return <PatientBills encounterId={encounterId || ''} patientId={selectedPatient?.id} />;

      case 'CloseEncounter':
        return (
          <div className="max-w-lg mx-auto py-12">
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Close Encounter</h2>
              <p className="text-gray-500 mb-6">Are you sure you want to close this encounter? This will mark the encounter as completed.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setActiveSection('Triage')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={async () => {
                  try {
                    if (encounterId && !String(encounterId).includes('_new')) {
                      await fetch(`/api/encounters/${encounterId}/close`, { method: 'POST' });
                    }
                    setSaveMessage({ type: 'success', message: 'Encounter closed successfully' });
                    setTimeout(() => navigate('/dashboard/triage'), 1500);
                  } catch(e) { setSaveMessage({ type: 'error', message: 'Failed to close encounter' }); }
                }} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">Close Encounter</button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🚧</div>
            <h3 className="text-lg font-semibold text-gray-600">Section: {activeSection}</h3>
            <p className="text-gray-400 mt-1">This section is loading...</p>
          </div>
        );
    }
  };

  // ----- JSX layout (same as your file, truncated in places for readability) -----
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Left Sidebar */}
      <div className={`bg-white border-r transition-all duration-300 flex flex-col ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b flex items-center justify-between">
          {!isSidebarCollapsed && (
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center text-slate-600 hover:text-slate-800 text-sm"
            >
              <span className="mr-2">←</span>
              Back to EMR/HMIS
            </button>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className={`p-2 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          <div className="bg-gray-100 rounded p-2 mb-2 flex items-center justify-center">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
          </div>
        </div>

        <nav className="p-4 overflow-y-auto flex-1">
          {sidebarItems.map(item => (
            <div key={item.id}>
              {item.hasDropdown ? (
                <div>
                  <button
                    onClick={() => toggleDropdown(item.id)}
                    className={`${linkClass(false)} w-full text-sm ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    {!isSidebarCollapsed && activeSection === item.id && (
                      <span className="absolute left-0 top-1 bottom-1 w-1.5 bg-blue-700 rounded-r-full" />
                    )}
                    <span className="w-5 h-5 flex items-center justify-center text-xs">{item.icon}</span>
                    {!isSidebarCollapsed && (
                      <>
                        <span className="ml-3 flex-1 text-left">{item.label}</span>
                        <svg className={`w-4 h-4 ml-auto text-slate-600 transform ${isDropdownOpen[item.id] ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>

                  {!isSidebarCollapsed && isDropdownOpen[item.id] && item.subItems && (
                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-200">
                      {item.subItems.map(subItem => (
                        <button key={subItem.id} onClick={() => {
                          setActiveSection(subItem.component);
                          if (selectedPatient && encounterId) {
                            navigate(`/encounters/investigations/${encounterId}`);
                          }
                        }} className={`w-full flex items-center px-4 py-2 text-sm hover:bg-slate-100 ${activeSection === subItem.component ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600' : 'text-slate-600'}`}>
                          <span className="ml-3">{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => item.component && setActiveSection(item.component)} className={`${linkClass(activeSection === item.component)} w-full text-sm ${isSidebarCollapsed ? 'justify-center' : ''}`} title={isSidebarCollapsed ? item.label : undefined}>
                  {!isSidebarCollapsed && activeSection === item.component && (
                    <span className="absolute left-0 top-1 bottom-1 w-1.5 bg-blue-700 rounded-r-full" />
                  )}
                  <span className="w-5 h-5 flex items-center justify-center text-xs">{item.icon}</span>
                  {!isSidebarCollapsed && <span className="ml-3">{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 pb-6">
          <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-16 flex items-center justify-between gap-4 mb-4 px-4 rounded-xl">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Main Dashboard
            </button>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                <span className="text-lg">🕐</span>
                <span className="text-sm font-medium text-slate-700">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button className="relative p-2.5 rounded-xl hover:bg-slate-100 transition-colors">
                <span className="text-xl">🔔</span>
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              </button>
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="text-xs text-slate-500">Administrator</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mb-4 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-slate-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search patients by name, phone, or patient number..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="flex-1 border-0 focus:outline-none text-slate-700 bg-transparent placeholder:text-slate-400"
              />
              {searchQuery.trim().length > 0 && (
                <span className="text-xs text-slate-400 mr-2 hidden sm:inline">
                  {isSearching ? "Searching..." : `${searchResults.length} result(s)`}
                </span>
              )}
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="ml-2 px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-lg z-50 max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No patients found</div>
                ) : (
                  searchResults.map(patient => (
                    <div key={patient.id} className="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer" onClick={() => handlePatientSelect(patient)}>
                      <div className="font-medium">{patient.firstName} {patient.lastName}</div>
                      <div className="text-sm text-gray-600">{patient.gender} • {calculateAge(patient.dob)} years • {patient.phone} • {patient.id}</div>
                      {patient.areaOfResidence && <div className="text-xs text-gray-500">{patient.areaOfResidence}</div>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {renderContent()}
        </div>
      </div>

      {/* Patient Overview Sidebar */}
      {selectedPatient && isPatientOverviewVisible && (
        <div className="w-64 bg-white border-l shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Patient overview</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Hide</span>
                <button onClick={() => setIsPatientOverviewVisible(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start space-x-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">{selectedPatient.firstName[0]}{selectedPatient.lastName[0]}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">{selectedPatient.firstName} {selectedPatient.lastName}</h4>
                <p className="text-sm text-gray-600">{selectedPatient.gender} • {calculateAge(selectedPatient.dob)} years • DOB: {formatDate(selectedPatient.dob)}</p>
                <div className="flex items-center mt-2"><span className="text-blue-600 mr-2">📞</span><span className="text-sm font-medium">{selectedPatient.phone}</span></div>
                <div className="flex items-center mt-2"><span className="text-blue-600 mr-2">Patient No</span><span className="text-sm font-medium">{selectedPatient.id}</span></div>
              </div>
            </div>

            {selectedPatient.email && (
              <div className="mb-4"><span className="text-xs text-gray-500">Email</span><p className="text-sm">{selectedPatient.email}</p></div>
            )}

            {selectedPatient.areaOfResidence && (
              <div className="mb-4"><span className="text-xs text-gray-500">Address</span><p className="text-sm">{selectedPatient.areaOfResidence}</p></div>
            )}

            {selectedPatient.patientStatus && (
              <div className="mb-4"><span className="text-xs text-gray-500">Status</span><p className="text-sm font-medium">{selectedPatient.patientStatus}</p></div>
            )}

            <div className="flex space-x-4 mb-4 border-b">
              {['Triage', 'Encounters', 'History'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-sm ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}>{tab}</button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Latest taken</span>
                  <button className="text-blue-600 hover:text-blue-800">View all</button>
                </div>
                {latestTriage ? (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-500">Category</span>
                        <p className={`font-medium ${latestTriage.patient_status === 'Stable' ? 'text-green-600' : latestTriage.patient_status === 'Critical' ? 'text-red-600' : 'text-yellow-600'}`}>{latestTriage.patient_status} ●</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Temperature</span>
                        <p className={`${parseFloat(latestTriage.temperature || '0') > 37.5 ? 'text-red-600' : ''}`}>{latestTriage.temperature || 'Not recorded'} °C</p>
                      </div>
                      <div><span className="text-xs text-gray-500">Heart rate</span><p>{latestTriage.heart_rate || 'Not recorded'} BPM</p></div>
                      <div><span className="text-xs text-gray-500">Blood pressure</span><p>{latestTriage.blood_pressure || 'Not recorded'} mmHg</p></div>
                      <div><span className="text-xs text-gray-500">Respiratory rate</span><p className={`${parseInt(latestTriage.respiratory_rate || '0') < 18 ? 'text-blue-600' : ''}`}>{latestTriage.respiratory_rate || 'Not recorded'} breaths/min</p></div>
                      <div><span className="text-xs text-gray-500">Blood oxygenation</span><p>{latestTriage.blood_oxygenation || 'Not recorded'} %</p></div>
                      <div><span className="text-xs text-gray-500">Weight</span><p>{latestTriage.weight || 'Not recorded'} kg</p></div>
                      <div><span className="text-xs text-gray-500">Height</span><p>{latestTriage.height || 'Not recorded'} cm</p></div>
                      <div><span className="text-xs text-gray-500">BMI</span><p className={`${calculateBMI(latestTriage.weight, latestTriage.height).includes('H') ? 'text-red-600' : ''}`}>{calculateBMI(latestTriage.weight, latestTriage.height)}</p></div>
                      <div><span className="text-xs text-gray-500">MUAC</span><p>{latestTriage.muac || 'Not recorded'}</p></div>
                    </div>
                    {latestTriage.lmp_date && <div className="mt-2 text-sm"><span className="text-xs text-gray-500">LMP</span><p>{calculateWeeksSinceLMP(latestTriage.lmp_date)}</p></div>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Not recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TriageEncounterPage;
