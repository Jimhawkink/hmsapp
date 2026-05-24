'use client';
// ============================================================
// TriageEncounterPage.tsx — ULTRA ROBUST FULL IMPLEMENTATION
// Schema: hms_patients, hms_triages, hms_encounters, hms_staff,
//         hms_complaints, hms_investigation_requests/results/tests,
//         hms_prescriptions, hms_diagnoses, hms_appointments
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Sub-page components ──
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

// ── Types ──
import { LabRequest, LabResult, LabType } from "../types/investigation";

interface HMSPatient {
  id: number;
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender: string;
  dob: string;
  patient_status?: string;
  phone: string;
  email?: string;
  occupation?: string;
  patient_number?: string;
  sha_number?: string;
  county?: string;
  sub_county?: string;
  area_of_residence?: string;
  next_of_kin_first_name?: string;
  next_of_kin_last_name?: string;
  next_of_kin_phone?: string;
  created_at: string;
  // Legacy field mappings
  firstName?: string;
  lastName?: string;
  middleName?: string;
  patientNumber?: string;
  shaNumber?: string;
  subCounty?: string;
  areaOfResidence?: string;
  nextOfKinFirstName?: string;
  nextOfKinLastName?: string;
  nextOfKinPhone?: string;
  heardAboutFacility?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface HMSTriage {
  id: number;
  patient_id: number;
  patient_status?: string;
  temperature?: number;
  heart_rate?: number;
  blood_pressure?: string;
  respiratory_rate?: number;
  blood_oxygenation?: number;
  weight?: number;
  height?: number;
  muac?: number;
  lmp_date?: string;
  comments?: string;
  date?: string;
  created_at: string;
  updated_at: string;
  // Legacy mappings
  patientStatus?: string;
  heartRate?: string;
  bloodPressure?: string;
  respiratoryRate?: string;
  bloodOxygenation?: string;
  lmpDate?: string;
}

interface HMSEncounter {
  id: number;
  encounter_number: string;
  encounter_type: string;
  priority_type: string;
  notes?: string;
  patient_id: number;
  provider_id: number;
  created_at: string;
  updated_at: string;
}

interface TriageForm {
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

type SectionKey =
  | 'Triage' | 'Complaints' | 'StructuredVisitForms' | 'ReviewOfSystems'
  | 'MedicationHistory' | 'Examination' | 'Laboratory' | 'Imaging'
  | 'DiagnosisAndPlan' | 'Prescription' | 'AppointmentSchedule'
  | 'PatientBills' | 'CloseEncounter';

// ── Helpers ──
const getToken = () =>
  localStorage.getItem('hms_token') || localStorage.getItem('token') || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

function getDisplayName() {
  try {
    const raw = localStorage.getItem('hms_user');
    const u = raw ? JSON.parse(raw) : null;
    return u?.name || [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'Administrator';
  } catch { return 'Administrator'; }
}

function getInitials(name: string) {
  const ignore = ['dr', 'mr', 'mrs', 'ms', 'prof'];
  const parts = name.split(/\s+/).filter(p => !ignore.includes(p.toLowerCase()));
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || 'AA';
}

function calcAge(dob: string): number {
  const b = new Date(dob); const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--;
  return age;
}

function fmtDate(d?: string): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d?: string): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function calcBMI(weight?: number | string, height?: number | string): string {
  const w = parseFloat(String(weight ?? ''));
  const h = parseFloat(String(height ?? '')) / 100;
  if (!w || !h || isNaN(w) || isNaN(h)) return '\u2014';
  const bmi = w / (h * h);
  const cat = bmi < 18.5 ? ' \u2193' : bmi > 25 ? ' \u2191' : '';
  return `${bmi.toFixed(1)}${cat}`;
}

function lmpWeeks(lmp?: string): string {
  if (!lmp) return '\u2014';
  const diff = Date.now() - new Date(lmp).getTime();
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 7))} wks (${fmtDate(lmp)})`;
}

// Normalize patient fields (handle both snake_case and camelCase from API)
function normalizePatient(p: any): HMSPatient {
  return {
    ...p,
    id: p.id,
    first_name: p.first_name || p.firstName || '',
    last_name: p.last_name || p.lastName || '',
    middle_name: p.middle_name || p.middleName || '',
    gender: p.gender || '',
    dob: p.dob || '',
    phone: p.phone || '',
    email: p.email || '',
    patient_number: p.patient_number || p.patientNumber || '',
    sha_number: p.sha_number || p.shaNumber || '',
    county: p.county || '',
    sub_county: p.sub_county || p.subCounty || '',
    area_of_residence: p.area_of_residence || p.areaOfResidence || '',
    next_of_kin_first_name: p.next_of_kin_first_name || p.nextOfKinFirstName || '',
    next_of_kin_last_name: p.next_of_kin_last_name || p.nextOfKinLastName || '',
    next_of_kin_phone: p.next_of_kin_phone || p.nextOfKinPhone || '',
    patient_status: p.patient_status || p.patientStatus || '',
    occupation: p.occupation || '',
    created_at: p.created_at || p.createdAt || '',
  };
}

// Normalize triage fields
function normalizeTriage(t: any): HMSTriage {
  return {
    ...t,
    id: t.id,
    patient_id: t.patient_id || t.patientId,
    patient_status: t.patient_status || t.patientStatus || '',
    temperature: t.temperature ? parseFloat(t.temperature) : undefined,
    heart_rate: t.heart_rate || t.heartRate ? parseInt(String(t.heart_rate || t.heartRate)) : undefined,
    blood_pressure: t.blood_pressure || t.bloodPressure || '',
    respiratory_rate: t.respiratory_rate || t.respiratoryRate ? parseInt(String(t.respiratory_rate || t.respiratoryRate)) : undefined,
    blood_oxygenation: t.blood_oxygenation || t.bloodOxygenation ? parseFloat(String(t.blood_oxygenation || t.bloodOxygenation)) : undefined,
    weight: t.weight ? parseFloat(String(t.weight)) : undefined,
    height: t.height ? parseFloat(String(t.height)) : undefined,
    muac: t.muac ? parseFloat(String(t.muac)) : undefined,
    lmp_date: t.lmp_date || t.lmpDate || '',
    comments: t.comments || '',
    date: t.date || '',
    created_at: t.created_at || t.createdAt || '',
    updated_at: t.updated_at || t.updatedAt || '',
  };
}

function statusColor(s?: string): string {
  if (!s) return 'bg-slate-100 text-slate-600';
  const m: Record<string, string> = {
    Stable: 'bg-emerald-100 text-emerald-700',
    Critical: 'bg-red-100 text-red-700',
    Unstable: 'bg-amber-100 text-amber-700',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
}

function vitalFlag(key: string, val?: number | string): 'ok' | 'high' | 'low' | 'none' {
  if (val === undefined || val === null || val === '') return 'none';
  const n = parseFloat(String(val));
  if (isNaN(n)) return 'none';
  const ranges: Record<string, [number, number]> = {
    temperature: [36, 37.5], heart_rate: [60, 100],
    respiratory_rate: [12, 20], blood_oxygenation: [95, 100],
  };
  const r = ranges[key];
  if (!r) return 'none';
  if (n < r[0]) return 'low';
  if (n > r[1]) return 'high';
  return 'ok';
}

function flagClass(f: 'ok' | 'high' | 'low' | 'none'): string {
  if (f === 'high') return 'text-red-600 font-bold';
  if (f === 'low') return 'text-blue-600 font-bold';
  return '';
}

// ── Sidebar config ──
const SIDEBAR: Array<{
  id: string; label: string; icon: string; section?: SectionKey;
  sub?: Array<{ id: string; label: string; section: SectionKey }>;
}> = [
  { id: 'triage',     label: 'Triage',               icon: '\uD83E\uDE7A', section: 'Triage' },
  { id: 'complaints', label: 'Complaints & HPI',      icon: '\uD83D\uDCAC', section: 'Complaints' },
  { id: 'structured', label: 'Structured Visit Forms', icon: '\uD83D\uDCDD', section: 'StructuredVisitForms' },
  { id: 'ros',        label: 'Review of Systems',     icon: '\uD83D\uDD0D', section: 'ReviewOfSystems' },
  { id: 'medhist',    label: 'Medication History',    icon: '\uD83D\uDC8A', section: 'MedicationHistory' },
  { id: 'exam',       label: 'Examination',           icon: '\uD83E\uDE7B', section: 'Examination' },
  {
    id: 'investigation', label: 'Investigation', icon: '\uD83D\uDD2C',
    sub: [
      { id: 'lab',     label: 'Laboratory', section: 'Laboratory' },
      { id: 'imaging', label: 'Imaging',    section: 'Imaging'    },
    ],
  },
  { id: 'diagnosis',   label: 'Diagnosis & Plan',      icon: '\uD83D\uDCCB', section: 'DiagnosisAndPlan' },
  { id: 'rx',          label: 'Prescription',          icon: '\uD83D\uDC8A', section: 'Prescription' },
  { id: 'appt',        label: 'Appointment Schedule',  icon: '\uD83D\uDCC5', section: 'AppointmentSchedule' },
  { id: 'bills',       label: 'Patient Bills',         icon: '\uD83D\uDCB0', section: 'PatientBills' },
  { id: 'close',       label: 'Close Encounter',       icon: '\u2705', section: 'CloseEncounter' },
];

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
const TriageEncounterPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Auth / UI ──
  const displayName = getDisplayName();
  const userInitials = getInitials(displayName);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  // ── Data ──
  const [patients, setPatients] = useState<HMSPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<HMSPatient | null>(null);
  const [triageHistory, setTriageHistory] = useState<HMSTriage[]>([]);
  const [latestTriage, setLatestTriage] = useState<HMSTriage | null>(null);
  const [encounter, setEncounter] = useState<HMSEncounter | null>(null);
  const [encounterId, setEncounterId] = useState<string | null>(null);

  // ── Search ──
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<HMSPatient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Triage form ──
  const EMPTY_TRIAGE: TriageForm = {
    patientStatus: '', temperature: '', heartRate: '', bloodPressure: '',
    respiratoryRate: '', bloodOxygenation: '', weight: '', height: '',
    muac: '', lmpDate: '', comments: '',
  };
  const [triageForm, setTriageForm] = useState<TriageForm>(EMPTY_TRIAGE);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Navigation ──
  const [activeSection, setActiveSection] = useState<SectionKey>('Triage');
  const [patientPanelVisible, setPatientPanelVisible] = useState(true);
  const [activePatientTab, setActivePatientTab] = useState<'triage' | 'info' | 'kin'>('triage');

  // ── Encounter creation ──
  const [creatingEncounter, setCreatingEncounter] = useState(false);
  const [showNewEncounterModal, setShowNewEncounterModal] = useState(false);
  const [newEncForm, setNewEncForm] = useState({
    encounter_type: 'Outpatient', priority_type: 'Normal', notes: '',
  });

  // ── Clock ──
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Search patients ──
  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : data.patients ?? data.data ?? []).map(normalizePatient);
        setSearchResults(list);
        setShowDropdown(true);
      } else {
        const q2 = q.toLowerCase();
        setSearchResults(patients.filter(p =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q2) ||
          (p.phone || '').includes(q2) ||
          (p.patient_number || '').toLowerCase().includes(q2)
        ));
        setShowDropdown(true);
      }
    } catch {
      const q2 = q.toLowerCase();
      setSearchResults(patients.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q2) ||
        (p.phone || '').includes(q2)
      ));
      setShowDropdown(true);
    } finally { setSearching(false); }
  }, [patients]);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(searchQ), 300);
    return () => clearTimeout(t);
  }, [searchQ, searchPatients]);

  // ── Fetch all patients on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/patients?limit=200', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : data.patients ?? data.data ?? [];
          setPatients(raw.map(normalizePatient));
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ── Select patient ──
  const handleSelectPatient = async (p: HMSPatient) => {
    const np = normalizePatient(p);
    setSelectedPatient(np);
    setSearchQ('');
    setShowDropdown(false);
    setActiveSection('Triage');
    setTriageForm(EMPTY_TRIAGE);
    setSaveMsg(null);
    setEncounter(null);
    setEncounterId(null);

    await fetchTriageHistory(np.id);

    try {
      const res = await fetch(`/api/encounters?patientId=${np.id}&limit=1`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const enc: HMSEncounter | null = Array.isArray(data)
          ? (data[0] ?? null)
          : (data.encounters?.[0] ?? data[0] ?? null);
        if (enc) { setEncounter(enc); setEncounterId(String(enc.id)); }
        else { setEncounterId(`new_${np.id}`); }
      } else { setEncounterId(`new_${np.id}`); }
    } catch { setEncounterId(`new_${np.id}`); }
  };

  // ── Fetch triage history ──
  const fetchTriageHistory = async (patientId: number) => {
    try {
      const res = await fetch(`/api/triage?patientId=${patientId}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.data ?? data.triages ?? [];
        const list = raw.map(normalizeTriage);
        const sorted = [...list].sort((a, b) =>
          new Date(b.date ?? b.created_at).getTime() - new Date(a.date ?? a.created_at).getTime()
        );
        setTriageHistory(sorted);
        setLatestTriage(sorted[0] ?? null);
      }
    } catch { setTriageHistory([]); setLatestTriage(null); }
  };

  // ── Save triage ──
  const handleSaveTriage = async () => {
    if (!selectedPatient) {
      setSaveMsg({ type: 'error', text: 'Select a patient first.' });
      return;
    }
    setSaving(true); setSaveMsg(null);
    try {
      const body = {
        patient_id: selectedPatient.id,
        patient_status: triageForm.patientStatus || undefined,
        temperature:        triageForm.temperature        ? parseFloat(triageForm.temperature)        : undefined,
        heart_rate:         triageForm.heartRate          ? parseInt(triageForm.heartRate)             : undefined,
        blood_pressure:     triageForm.bloodPressure      || undefined,
        respiratory_rate:   triageForm.respiratoryRate    ? parseInt(triageForm.respiratoryRate)       : undefined,
        blood_oxygenation:  triageForm.bloodOxygenation   ? parseFloat(triageForm.bloodOxygenation)   : undefined,
        weight:             triageForm.weight             ? parseFloat(triageForm.weight)             : undefined,
        height:             triageForm.height             ? parseFloat(triageForm.height)             : undefined,
        muac:               triageForm.muac               ? parseFloat(triageForm.muac)               : undefined,
        lmp_date:           triageForm.lmpDate            || undefined,
        comments:           triageForm.comments           || undefined,
        date:               new Date().toISOString(),
        encounter_id:       encounterId && !String(encounterId).startsWith('new_') ? encounterId : undefined,
      };
      const res = await fetch('/api/triage', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaveMsg({ type: 'success', text: 'Triage readings saved successfully \u2713' });
        setTriageForm(EMPTY_TRIAGE);
        await fetchTriageHistory(selectedPatient.id);
        setTimeout(() => setSaveMsg(null), 4000);
      } else {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.message || e.error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      setSaveMsg({ type: 'error', text: e.message ?? 'Failed to save triage.' });
    } finally { setSaving(false); }
  };

  // ── Create new encounter ──
  const handleCreateEncounter = async () => {
    if (!selectedPatient) return;
    setCreatingEncounter(true);
    try {
      const userRaw = localStorage.getItem('hms_user');
      const user = userRaw ? JSON.parse(userRaw) : {};
      const providerId = user.id || user.staff_id || 1;
      const body = {
        patient_id: selectedPatient.id,
        provider_id: providerId,
        encounter_type: newEncForm.encounter_type,
        priority_type: newEncForm.priority_type,
        notes: newEncForm.notes || undefined,
        encounter_number: `ENC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      };
      const res = await fetch('/api/encounters', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const enc: HMSEncounter = data.encounter ?? data;
        setEncounter(enc);
        setEncounterId(String(enc.id));
        setShowNewEncounterModal(false);
        setSaveMsg({ type: 'success', text: `Encounter ${enc.encounter_number} created \u2713` });
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        const e = await res.json().catch(() => ({}));
        setSaveMsg({ type: 'error', text: e.message || 'Failed to create encounter.' });
      }
    } catch (e: any) {
      setSaveMsg({ type: 'error', text: e.message ?? 'Failed to create encounter.' });
    } finally { setCreatingEncounter(false); }
  };

  // ── Close encounter ──
  const handleCloseEncounter = async () => {
    if (!encounterId || String(encounterId).startsWith('new_')) {
      setSaveMsg({ type: 'error', text: 'No active encounter to close.' });
      return;
    }
    try {
      await fetch(`/api/encounters/${encounterId}/close`, {
        method: 'POST', headers: authHeaders(),
      });
      setSaveMsg({ type: 'success', text: 'Encounter closed successfully.' });
      setTimeout(() => navigate('/dashboard/triage'), 1500);
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to close encounter.' });
    }
  };

  // ── Input helper ──
  const inp = (field: keyof TriageForm) => ({
    value: triageForm[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setTriageForm(f => ({ ...f, [field]: e.target.value })),
    className: 'w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white placeholder:text-slate-300 transition-all hover:border-slate-300',
  });

  // ── Sidebar nav ──
  const navTo = (section: SectionKey) => {
    if (!selectedPatient && section !== 'Triage') {
      setSaveMsg({ type: 'error', text: 'Please select a patient first.' });
      return;
    }
    setActiveSection(section);
    setSaveMsg(null);
  };

  // ── RENDER MAIN CONTENT ──
  const renderContent = () => {
    if (!selectedPatient) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div style={{ background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)' }}
            className="w-28 h-28 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <span className="text-5xl">{'\uD83D\uDD0D'}</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Search for a Patient</h2>
          <p className="text-slate-400 text-sm max-w-xs">
            Use the search bar above to find a patient by name, phone or patient number
          </p>
        </div>
      );
    }

    const noEncounterBanner = encounterId && String(encounterId).startsWith('new_') ? (
      <div className="mb-5 p-4 rounded-2xl flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{'\u26A0\uFE0F'}</span>
          <div>
            <p className="text-sm font-bold text-amber-800">No Active Encounter</p>
            <p className="text-xs text-amber-600">Create an encounter to enable all clinical sections.</p>
          </div>
        </div>
        <button onClick={() => setShowNewEncounterModal(true)}
          className="px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-all shadow-md hover:shadow-lg">
          + Create Encounter
        </button>
      </div>
    ) : null;

    switch (activeSection) {
      case 'Triage': return (
        <div>
          {noEncounterBanner}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800">
                Triage {'\u2014'} {selectedPatient.first_name} {selectedPatient.last_name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {selectedPatient.gender} {'\u00B7'} {calcAge(selectedPatient.dob)} yrs {'\u00B7'} DOB: {fmtDate(selectedPatient.dob)}
                {selectedPatient.patient_number && ` \u00B7 #${selectedPatient.patient_number}`}
              </p>
            </div>
            <div className="flex gap-2">
              {!encounter && (
                <button onClick={() => setShowNewEncounterModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-white text-xs font-bold rounded-xl hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  + New Encounter
                </button>
              )}
              {encounter && (
                <div className="px-4 py-2.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #a7f3d0' }}>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Active Encounter</p>
                  <p className="text-xs font-mono font-bold text-emerald-800">{encounter.encounter_number}</p>
                </div>
              )}
            </div>
          </div>

          {saveMsg && (
            <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              saveMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <span>{saveMsg.type === 'success' ? '\u2705' : '\u274C'}</span>
              {saveMsg.text}
              <button onClick={() => setSaveMsg(null)} className="ml-auto text-lg leading-none opacity-50 hover:opacity-100">{'\u00D7'}</button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm" style={{ background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-5 flex items-center gap-2">
              <span style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {'\u2764\uFE0F\u200D\uD83E\uDE79'} VITAL SIGNS
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Patient Status</label>
                <select {...inp('patientStatus')}>
                  <option value="">{'\u2014'} Select {'\u2014'}</option>
                  {['Stable', 'Unstable', 'Critical'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Temperature ({'\u00B0'}C)</label>
                <input type="number" step="0.1" placeholder="36.5" {...inp('temperature')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Heart Rate (bpm)</label>
                <input type="number" placeholder="72" {...inp('heartRate')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Blood Pressure (mmHg)</label>
                <input type="text" placeholder="120/80" {...inp('bloodPressure')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Respiratory Rate (/min)</label>
                <input type="number" placeholder="16" {...inp('respiratoryRate')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">SpO{'\u2082'} (%)</label>
                <input type="number" min={0} max={100} placeholder="98" {...inp('bloodOxygenation')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weight (kg)</label>
                <input type="number" step="0.1" placeholder="65" {...inp('weight')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Height (cm)</label>
                <input type="number" step="0.1" placeholder="170" {...inp('height')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">MUAC (cm)</label>
                <input type="number" step="0.1" placeholder="25" {...inp('muac')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">LMP Date</label>
                <input type="date" {...inp('lmpDate')} />
              </div>
              {triageForm.weight && triageForm.height && (
                <div className="flex items-end">
                  <div className="w-full px-3 py-2.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
                    <p className="text-[10px] text-sky-500 font-bold uppercase">Calculated BMI</p>
                    <p className="text-lg font-black text-slate-800">{calcBMI(triageForm.weight, triageForm.height)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Clinical Notes</label>
              <textarea rows={2} placeholder="Clinical observations, allergies, medication notes..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none hover:border-slate-300 transition-all"
                value={triageForm.comments}
                onChange={e => setTriageForm(f => ({ ...f, comments: e.target.value }))} />
            </div>

            <button onClick={handleSaveTriage} disabled={saving}
              className="mt-5 px-6 py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60 flex items-center gap-2 shadow-lg hover:shadow-xl"
              style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>
              {saving ? <><span className="animate-spin">{'\u23F3'}</span> Saving...</> : <>{'\uD83D\uDCBE'} Save Triage Readings</>}
            </button>
          </div>

          {/* Triage History */}
          <div className="rounded-2xl border border-slate-200 p-6 shadow-sm bg-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">{'\uD83D\uDCC8'} Triage History</h3>
              <button onClick={() => selectedPatient && fetchTriageHistory(selectedPatient.id)}
                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                {'\u21BA'} Refresh
              </button>
            </div>
            {triageHistory.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm">No triage records for this patient yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {triageHistory.map((t, i) => (
                  <div key={t.id} className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                    i === 0 ? 'border-blue-200 bg-blue-50/50' : 'border-slate-100 bg-slate-50/50'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="px-2.5 py-0.5 text-white text-[10px] font-bold rounded-full" style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}>LATEST</span>}
                        <span className="text-xs font-bold text-slate-600">{fmtDateTime(t.date ?? t.created_at)}</span>
                      </div>
                      {t.patient_status && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor(t.patient_status)}`}>
                          {t.patient_status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-xs">
                      {[
                        { k: 'Temp', v: t.temperature ? `${t.temperature}\u00B0C` : '\u2014', flag: vitalFlag('temperature', t.temperature) },
                        { k: 'HR', v: t.heart_rate ? `${t.heart_rate} bpm` : '\u2014', flag: vitalFlag('heart_rate', t.heart_rate) },
                        { k: 'BP', v: t.blood_pressure ?? '\u2014', flag: 'none' as const },
                        { k: 'RR', v: t.respiratory_rate ? `${t.respiratory_rate}/min` : '\u2014', flag: vitalFlag('respiratory_rate', t.respiratory_rate) },
                        { k: 'SpO\u2082', v: t.blood_oxygenation ? `${t.blood_oxygenation}%` : '\u2014', flag: vitalFlag('blood_oxygenation', t.blood_oxygenation) },
                        { k: 'Wt', v: t.weight ? `${t.weight} kg` : '\u2014', flag: 'none' as const },
                        { k: 'Ht', v: t.height ? `${t.height} cm` : '\u2014', flag: 'none' as const },
                        { k: 'BMI', v: calcBMI(t.weight, t.height), flag: 'none' as const },
                        { k: 'MUAC', v: t.muac ? `${t.muac} cm` : '\u2014', flag: 'none' as const },
                      ].map(({ k, v, flag }) => (
                        <div key={k} className="px-2 py-1.5 rounded-lg bg-white/70">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{k}</p>
                          <p className={`font-bold text-slate-700 ${flagClass(flag)}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                    {t.lmp_date && <p className="mt-2 text-xs text-slate-500"><span className="font-semibold">LMP:</span> {lmpWeeks(t.lmp_date)}</p>}
                    {t.comments && <p className="mt-1 text-xs text-slate-600 italic">{'\u201C'}{t.comments}{'\u201D'}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );

      case 'Complaints':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">Complaints & HPI</h2>
            <ComplaintsPage />
          </div>
        );

      case 'StructuredVisitForms':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">Structured Visit Forms</h2>
            <StructuredVisitForms encounterId={encounterId ?? ''} patientId={selectedPatient?.id} />
          </div>
        );

      case 'ReviewOfSystems':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">Review of Systems</h2>
            <ReviewOfSystems encounterId={encounterId ?? ''} />
          </div>
        );

      case 'MedicationHistory':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">Medication History</h2>
            <MedicationHistory encounterId={encounterId ?? ''} patientId={selectedPatient?.id} />
          </div>
        );

      case 'Examination':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">Physical Examination</h2>
            <PhysicalExamination encounterId={encounterId ?? ''} />
          </div>
        );

      case 'Laboratory':
      case 'Imaging':
        if (!encounterId || String(encounterId).startsWith('new_')) {
          return (
            <div className="mt-4 p-8 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
              <p className="text-amber-700 font-bold mb-3">An encounter is required to request investigations.</p>
              <button onClick={() => setShowNewEncounterModal(true)}
                className="px-5 py-2.5 bg-amber-500 text-white font-bold rounded-xl text-sm hover:bg-amber-600 transition-all">
                Create Encounter
              </button>
            </div>
          );
        }
        return (
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">
              {activeSection === 'Laboratory' ? '\uD83D\uDD2C Laboratory' : '\uD83E\uDE7B Imaging'}
            </h2>
            <InvestigationPage encounterId={encounterId} activeTab={activeSection as any} />
          </div>
        );

      case 'DiagnosisAndPlan':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">{'\uD83D\uDCCB'} Diagnosis & Management Plan</h2>
            <DiagnosisAndPlan encounterId={encounterId ?? ''} />
          </div>
        );

      case 'Prescription':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">{'\uD83D\uDC8A'} Prescription</h2>
            <PrescriptionForm encounterId={encounterId ?? ''} patientId={selectedPatient?.id} />
          </div>
        );

      case 'AppointmentSchedule':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">{'\uD83D\uDCC5'} Appointment Schedule</h2>
            <EncounterAppointment encounterId={encounterId ?? ''} patientId={selectedPatient?.id} />
          </div>
        );

      case 'PatientBills':
        return (
          <div>
            {noEncounterBanner}
            <h2 className="text-2xl font-extrabold text-slate-800 mb-5">{'\uD83D\uDCB0'} Patient Bills</h2>
            <PatientBills encounterId={encounterId ?? ''} patientId={selectedPatient?.id} />
          </div>
        );

      case 'CloseEncounter':
        return (
          <div className="max-w-lg mx-auto py-12">
            <div className="rounded-2xl border border-slate-200 shadow-xl p-8 text-center bg-white">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)' }}>
                <span className="text-4xl">{'\u2705'}</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 mb-2">Close Encounter</h2>
              {encounter ? (
                <>
                  <p className="text-slate-500 text-sm mb-1">Encounter: <span className="font-mono font-bold text-slate-700">{encounter.encounter_number}</span></p>
                  <p className="text-slate-400 text-sm mb-6">This will mark the encounter as completed. All clinical data entered will be saved.</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setActiveSection('Triage')}
                      className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
                    <button onClick={handleCloseEncounter}
                      className="px-5 py-2.5 text-white rounded-xl text-sm font-bold transition-all shadow-lg"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>Close Encounter</button>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-sm">No active encounter to close.</p>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="py-12 text-center text-slate-400">
            <p className="text-4xl mb-3">{'\uD83D\uDEA7'}</p>
            <p className="font-semibold">{activeSection} {'\u2014'} coming soon</p>
          </div>
        );
    }
  };

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ──── LEFT SIDEBAR ──── */}
      <aside className={`flex flex-col transition-all duration-300 shrink-0 ${collapsed ? 'w-16' : 'w-60'}`}
        style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderRight: '1px solid #e2e8f0' }}>
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-100">
          {!collapsed && (
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
              {'\u2190'} Back to Dashboard
            </button>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <span className={`block transition-transform duration-300 text-sm ${collapsed ? 'rotate-180' : ''}`}>{'\u25C0'}</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {SIDEBAR.map(item => {
            if (item.sub) {
              const open = openDropdowns[item.id];
              const childActive = item.sub.some(s => s.section === activeSection);
              return (
                <div key={item.id}>
                  <button
                    onClick={() => setOpenDropdowns(d => ({ ...d, [item.id]: !d[item.id] }))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      childActive ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title={collapsed ? item.label : undefined}>
                    <span className="text-base w-5 text-center">{item.icon}</span>
                    {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                    {!collapsed && <span className={`transition-transform duration-200 text-[10px] ${open ? 'rotate-180' : ''}`}>{'\u25BE'}</span>}
                  </button>
                  {!collapsed && open && (
                    <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-3">
                      {item.sub.map(s => (
                        <button key={s.id}
                          onClick={() => navTo(s.section)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            activeSection === s.section ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button key={item.id}
                onClick={() => item.section && navTo(item.section)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all relative ${
                  activeSection === item.section
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}>
                {activeSection === item.section && !collapsed && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full" style={{ background: 'linear-gradient(180deg, #3b82f6, #6366f1)' }} />
                )}
                <span className="text-base w-5 text-center">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100">
            <div className="px-3 py-2 rounded-xl bg-slate-50 text-center">
              <p className="text-[10px] text-slate-400 font-semibold">HMS v2.0</p>
              <p className="text-[9px] text-slate-300">Hospital Management System</p>
            </div>
          </div>
        )}
      </aside>

      {/* ──── MAIN AREA ──── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center gap-3 shrink-0 shadow-sm">
          <div className="relative flex-1 max-w-lg">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <span className="text-slate-400 text-sm">{'\uD83D\uDD0D'}</span>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onFocus={() => searchQ && setShowDropdown(true)}
                placeholder="Search patient by name, phone, ID..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300"
              />
              {searching && <span className="text-[10px] text-blue-500 animate-pulse font-semibold">Searching...</span>}
              {searchQ && (
                <button onClick={() => { setSearchQ(''); setShowDropdown(false); }}
                  className="text-slate-300 hover:text-slate-500 text-lg leading-none">{'\u00D7'}</button>
              )}
            </div>
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
                  <p className="text-[10px] text-slate-400 font-bold uppercase px-2">
                    {searchResults.length} patient{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 group">
                    <p className="font-bold text-sm text-slate-800 group-hover:text-blue-700">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-slate-500">
                      {p.gender} {'\u00B7'} {calcAge(p.dob)} yrs {'\u00B7'} {p.phone}
                      {p.patient_number ? ` \u00B7 #${p.patient_number}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && !searching && searchQ.trim() && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-6 text-center">
                <p className="text-sm text-slate-400">No patients found for {'\u201C'}{searchQ}{'\u201D'}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', border: '1px solid #e2e8f0' }}>
              <span className="text-sm">{'\uD83D\uDD50'}</span>
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="relative">
              <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <span className="text-lg">{'\uD83D\uDD14'}</span>
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-lg"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                {userInitials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{displayName}</p>
                <p className="text-[10px] text-slate-400">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden flex">
          <main className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </main>

          {/* ──── RIGHT PATIENT PANEL ──── */}
          {selectedPatient && patientPanelVisible && (
            <aside className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Patient Overview</h3>
                <button onClick={() => setPatientPanelVisible(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Hide {'\u203A'}</button>
              </div>

              {/* Patient card */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                    style={{ background: selectedPatient.gender === 'Female' ? 'linear-gradient(135deg, #ec4899, #f43f5e)' : 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                    {getInitials(`${selectedPatient.first_name} ${selectedPatient.last_name}`)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                    <p className="text-xs text-slate-500">{selectedPatient.gender} {'\u00B7'} {calcAge(selectedPatient.dob)} years</p>
                    <p className="text-xs text-slate-400">DOB: {fmtDate(selectedPatient.dob)}</p>
                  </div>
                </div>
                {selectedPatient.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                    <span>{'\uD83D\uDCDE'}</span> {selectedPatient.phone}
                  </div>
                )}
                {selectedPatient.patient_number && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold">
                    <span>#</span> Patient No {selectedPatient.patient_number}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {(['triage', 'info', 'kin'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => setActivePatientTab(tab)}
                    className={`flex-1 py-2.5 text-[11px] font-bold text-center transition-all ${
                      activePatientTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}>
                    {tab === 'triage' ? 'Vitals' : tab === 'info' ? 'Info' : 'Next of Kin'}
                  </button>
                ))}
              </div>

              <div className="p-4 flex-1">
                {activePatientTab === 'triage' && latestTriage && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Latest Vitals</p>
                      {latestTriage.patient_status && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(latestTriage.patient_status)}`}>
                          {latestTriage.patient_status}
                        </span>
                      )}
                    </div>
                    {[
                      { label: 'Temperature', value: latestTriage.temperature ? `${latestTriage.temperature}\u00B0C` : '\u2014', flag: vitalFlag('temperature', latestTriage.temperature) },
                      { label: 'Heart Rate', value: latestTriage.heart_rate ? `${latestTriage.heart_rate} BPM` : '\u2014', flag: vitalFlag('heart_rate', latestTriage.heart_rate) },
                      { label: 'Blood Pressure', value: latestTriage.blood_pressure || '\u2014', flag: 'none' as const },
                      { label: 'Respiratory Rate', value: latestTriage.respiratory_rate ? `${latestTriage.respiratory_rate}/min` : '\u2014', flag: vitalFlag('respiratory_rate', latestTriage.respiratory_rate) },
                      { label: 'SpO\u2082', value: latestTriage.blood_oxygenation ? `${latestTriage.blood_oxygenation}%` : '\u2014', flag: vitalFlag('blood_oxygenation', latestTriage.blood_oxygenation) },
                      { label: 'Weight', value: latestTriage.weight ? `${latestTriage.weight} kg` : '\u2014', flag: 'none' as const },
                      { label: 'Height', value: latestTriage.height ? `${latestTriage.height} cm` : '\u2014', flag: 'none' as const },
                      { label: 'BMI', value: calcBMI(latestTriage.weight, latestTriage.height), flag: 'none' as const },
                      { label: 'MUAC', value: latestTriage.muac ? `${latestTriage.muac} cm` : '\u2014', flag: 'none' as const },
                    ].map(({ label, value, flag }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className={`text-xs font-bold ${flagClass(flag)} ${value === '\u2014' ? 'text-slate-300' : ''}`}>{value}</span>
                      </div>
                    ))}
                    {latestTriage.lmp_date && (
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-xs text-slate-500">LMP</span>
                        <span className="text-xs font-bold text-slate-700">{lmpWeeks(latestTriage.lmp_date)}</span>
                      </div>
                    )}
                  </div>
                )}
                {activePatientTab === 'triage' && !latestTriage && (
                  <p className="text-xs text-slate-400 text-center py-6">No vitals recorded yet</p>
                )}

                {activePatientTab === 'info' && (
                  <div className="space-y-2">
                    {[
                      { label: 'Email', value: selectedPatient.email },
                      { label: 'Occupation', value: selectedPatient.occupation },
                      { label: 'SHA Number', value: selectedPatient.sha_number },
                      { label: 'County', value: selectedPatient.county },
                      { label: 'Sub-County', value: selectedPatient.sub_county },
                      { label: 'Area', value: selectedPatient.area_of_residence },
                      { label: 'Registered', value: fmtDate(selectedPatient.created_at) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-xs font-semibold text-slate-700 text-right max-w-[140px] truncate">{value || '\u2014'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activePatientTab === 'kin' && (
                  <div className="space-y-2">
                    {[
                      { label: 'First Name', value: selectedPatient.next_of_kin_first_name },
                      { label: 'Last Name', value: selectedPatient.next_of_kin_last_name },
                      { label: 'Phone', value: selectedPatient.next_of_kin_phone },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-xs font-semibold text-slate-700">{value || '\u2014'}</span>
                      </div>
                    ))}
                    {!selectedPatient.next_of_kin_first_name && !selectedPatient.next_of_kin_last_name && (
                      <p className="text-xs text-slate-400 text-center py-4">No next of kin recorded</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Show button when panel is hidden */}
          {selectedPatient && !patientPanelVisible && (
            <button onClick={() => setPatientPanelVisible(true)}
              className="absolute right-0 top-20 px-2 py-3 bg-blue-600 text-white text-[10px] font-bold rounded-l-xl shadow-lg hover:bg-blue-700 transition-all z-10"
              style={{ writingMode: 'vertical-rl' }}>
              Patient {'\u2039'}
            </button>
          )}
        </div>
      </div>

      {/* ──── NEW ENCOUNTER MODAL ──── */}
      {showNewEncounterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowNewEncounterModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800 mb-5">Create New Encounter</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Encounter Type</label>
                <select value={newEncForm.encounter_type} onChange={e => setNewEncForm(f => ({ ...f, encounter_type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  {['Outpatient', 'Inpatient', 'Emergency', 'Walk-in', 'Referral', 'Follow-up'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Priority</label>
                <select value={newEncForm.priority_type} onChange={e => setNewEncForm(f => ({ ...f, priority_type: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  {['Normal', 'Urgent', 'Emergency'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes (optional)</label>
                <textarea value={newEncForm.notes} onChange={e => setNewEncForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Encounter notes..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewEncounterModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreateEncounter} disabled={creatingEncounter}
                className="flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                {creatingEncounter ? 'Creating...' : 'Create Encounter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── GLOBAL TOAST ──── */}
      {saveMsg && activeSection !== 'Triage' && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 z-50 animate-in slide-in-from-bottom-5 ${
          saveMsg.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span>{saveMsg.type === 'success' ? '\u2705' : '\u274C'}</span>
          {saveMsg.text}
          <button onClick={() => setSaveMsg(null)} className="ml-2 opacity-70 hover:opacity-100">{'\u00D7'}</button>
        </div>
      )}
    </div>
  );
};

export default TriageEncounterPage;
