// src/pages/InvestigationPage.tsx
import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  X,
  Search,
  Mail,
  MoreVertical,
  Info,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InvestigationRequest {
  id: number;
  test_id: number | null;
  department: string | null;
  type: "laboratory" | "imaging";
  status: "requested" | "not_collected" | "collected" | "results_posted";
  request_notes: string | null;
  results?: InvestigationResult[];
  test?: InvestigationTest;
  date_requested?: string;
  requested_by?: number | null;
  custom_name?: string;
}

interface ResultToSave {
  request_id: number;
  parameter: string;
  value: string;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  notes: string | null;
  entered_by: number;
  date_entered: string;
}

interface InvestigationResult {
  id: number;
  parameter: string | null;
  value: string;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
}

interface InvestigationTest {
  id: number;
  name: string;
  department: string;
  type: "laboratory" | "imaging";
  parameters: string | null;
}

interface InvestigationPageProps {
  encounterId?: string;
  activeTab?: "Laboratory" | "Imaging";
  currentUserId?: number; // optional - we read from localStorage if not passed
}

const InvestigationPage: React.FC<InvestigationPageProps> = ({
  encounterId: propEncounterId,
  activeTab: propActiveTab,
  currentUserId: propCurrentUserId,
}) => {
  const encounterId = propEncounterId || "demo-encounter-123";
  const [activeTab, setActiveTab] = useState<"Laboratory" | "Imaging">(
    propActiveTab || "Laboratory"
  );
  const [requests, setRequests] = useState<InvestigationRequest[]>([]);
  const [tests, setTests] = useState<InvestigationTest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [otherRequest, setOtherRequest] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [expandedResults, setExpandedResults] = useState<{ [key: number]: boolean }>({ 1: true });
  const [expandedTestItems, setExpandedTestItems] = useState<{ [key: string]: boolean }>({});
  const [resultInputs, setResultInputs] = useState<{ [key: string]: string }>({});
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // current user & token from localStorage
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("hms_user") || localStorage.getItem("user");
      const token = localStorage.getItem("hms_token") || localStorage.getItem("token");
      setAuthToken(token || null);
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        setCurrentUser(parsed);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.warn("Failed to read logged-in user from localStorage", e);
      setCurrentUser(null);
    }
  }, []);

  // small helper to call API with auth header
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = authToken || localStorage.getItem("hms_token") || localStorage.getItem("token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers ? (options.headers as Record<string, string>) : {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const resp = await fetch(url, { ...options, headers });
    return resp;
  };

  const defaultTests: InvestigationTest[] = [
    // COVID-19
    { id: 101, name: "COVID-19 PCR Test", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "SARS-CoV-2 RNA", "unit": "", "range": "Not Detected/Detected"}]' },
    { id: 102, name: "COVID-19 Rapid Antigen Test", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "SARS-CoV-2 Antigen", "unit": "", "range": "Negative/Positive"}]' },
    { id: 103, name: "COVID-19 Antibody Test (IgG/IgM)", department: "Serology", type: "laboratory", parameters: '[{"parameter": "SARS-CoV-2 IgG", "unit": "", "range": "Negative/Positive"}, {"parameter": "SARS-CoV-2 IgM", "unit": "", "range": "Negative/Positive"}]' },
    // Haematology
    { id: 1, name: "Haemogram (CBC)", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "Hemoglobin", "unit": "g/dl", "range": "12-16"}, {"parameter": "WBC Count", "unit": "/cmm", "range": "4000-11000"}, {"parameter": "Platelet Count", "unit": "/cmm", "range": "150000-450000"}, {"parameter": "RBC Count", "unit": "M/uL", "range": "4.0-5.5"}, {"parameter": "Hematocrit", "unit": "%", "range": "36-48"}, {"parameter": "MCV", "unit": "fL", "range": "80-100"}, {"parameter": "MCH", "unit": "pg", "range": "27-31"}, {"parameter": "MCHC", "unit": "g/dL", "range": "32-36"}]' },
    { id: 2, name: "ESR", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "ESR", "unit": "mm/hr", "range": "0-20"}]' },
    { id: 3, name: "Blood Group & Rh", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "Blood Group", "unit": "", "range": "A/B/AB/O"}, {"parameter": "Rh Factor", "unit": "", "range": "Positive/Negative"}]' },
    { id: 4, name: "Peripheral Blood Smear", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "RBC Morphology", "unit": "", "range": "Normal"}, {"parameter": "WBC Morphology", "unit": "", "range": "Normal"}, {"parameter": "Platelet Morphology", "unit": "", "range": "Normal"}]' },
    { id: 5, name: "Coagulation Profile (PT/INR/APTT)", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "PT", "unit": "seconds", "range": "11-13.5"}, {"parameter": "INR", "unit": "", "range": "0.8-1.2"}, {"parameter": "APTT", "unit": "seconds", "range": "25-35"}]' },
    { id: 6, name: "D-Dimer", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "D-Dimer", "unit": "ng/mL", "range": "<500"}]' },
    { id: 7, name: "Reticulocyte Count", department: "Haematology", type: "laboratory", parameters: '[{"parameter": "Reticulocyte Count", "unit": "%", "range": "0.5-2.5"}]' },
    // Biochemistry
    { id: 10, name: "Lipid Profile", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Total Cholesterol", "unit": "mg/dl", "range": "<200"}, {"parameter": "HDL", "unit": "mg/dl", "range": ">40"}, {"parameter": "LDL", "unit": "mg/dl", "range": "<100"}, {"parameter": "Triglycerides", "unit": "mg/dl", "range": "<150"}]' },
    { id: 11, name: "Renal Function Test (RFT/UEC)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Urea", "unit": "mg/dL", "range": "7-20"}, {"parameter": "Creatinine", "unit": "mg/dL", "range": "0.6-1.2"}, {"parameter": "Sodium", "unit": "mmol/L", "range": "135-145"}, {"parameter": "Potassium", "unit": "mmol/L", "range": "3.5-5.0"}, {"parameter": "Chloride", "unit": "mmol/L", "range": "98-106"}]' },
    { id: 12, name: "Liver Function Test (LFT)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "ALT/SGPT", "unit": "U/L", "range": "7-56"}, {"parameter": "AST/SGOT", "unit": "U/L", "range": "10-40"}, {"parameter": "ALP", "unit": "U/L", "range": "44-147"}, {"parameter": "Total Bilirubin", "unit": "mg/dL", "range": "0.1-1.2"}, {"parameter": "Direct Bilirubin", "unit": "mg/dL", "range": "0-0.3"}, {"parameter": "Total Protein", "unit": "g/dL", "range": "6.0-8.3"}, {"parameter": "Albumin", "unit": "g/dL", "range": "3.4-5.4"}]' },
    { id: 13, name: "Blood Sugar (Random)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Random Blood Sugar", "unit": "mg/dL", "range": "70-140"}]' },
    { id: 14, name: "Blood Sugar (Fasting)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Fasting Blood Sugar", "unit": "mg/dL", "range": "70-100"}]' },
    { id: 15, name: "HbA1c", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "HbA1c", "unit": "%", "range": "<5.7"}]' },
    { id: 16, name: "Thyroid Function Test (TFT)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "TSH", "unit": "mIU/L", "range": "0.4-4.0"}, {"parameter": "T3", "unit": "ng/dL", "range": "80-200"}, {"parameter": "T4", "unit": "ug/dL", "range": "4.5-12.5"}, {"parameter": "Free T4", "unit": "ng/dL", "range": "0.8-1.8"}]' },
    { id: 17, name: "Uric Acid", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Uric Acid", "unit": "mg/dL", "range": "3.5-7.2"}]' },
    { id: 18, name: "Calcium", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Serum Calcium", "unit": "mg/dL", "range": "8.5-10.5"}]' },
    { id: 19, name: "Magnesium", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Serum Magnesium", "unit": "mg/dL", "range": "1.7-2.2"}]' },
    { id: 20, name: "Amylase", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Amylase", "unit": "U/L", "range": "28-100"}]' },
    { id: 21, name: "Lipase", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Lipase", "unit": "U/L", "range": "0-160"}]' },
    { id: 22, name: "CRP (C-Reactive Protein)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "CRP", "unit": "mg/L", "range": "<10"}]' },
    { id: 23, name: "Troponin I", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "Troponin I", "unit": "ng/mL", "range": "<0.04"}]' },
    { id: 24, name: "PSA (Prostate Specific Antigen)", department: "Biochemistry", type: "laboratory", parameters: '[{"parameter": "PSA", "unit": "ng/mL", "range": "0-4.0"}]' },
    // Microbiology
    { id: 30, name: "Malaria Antigen (mRDT)", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Malaria Antigen", "unit": "", "range": "Negative/Positive"}]' },
    { id: 31, name: "Malaria Blood Smear (BS for MPS)", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Malaria Parasites", "unit": "", "range": "Not seen/Seen"}, {"parameter": "Species", "unit": "", "range": "P.falciparum/P.vivax/P.malariae/P.ovale"}, {"parameter": "Parasite Density", "unit": "/uL", "range": ""}]' },
    { id: 32, name: "HIV Test", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "HIV 1/2 Antibody", "unit": "", "range": "Negative/Positive"}]' },
    { id: 33, name: "Hepatitis B Surface Antigen (HBsAg)", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "HBsAg", "unit": "", "range": "Non-reactive/Reactive"}]' },
    { id: 34, name: "Hepatitis C Antibody", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "HCV Ab", "unit": "", "range": "Non-reactive/Reactive"}]' },
    { id: 35, name: "Syphilis VDRL/RPR", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "VDRL/RPR", "unit": "", "range": "Non-reactive/Reactive"}]' },
    { id: 36, name: "Syphilis TPHA", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "TPHA", "unit": "", "range": "Non-reactive/Reactive"}]' },
    { id: 37, name: "Widal Test", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Salmonella Typhi O", "unit": "", "range": "<1:80"}, {"parameter": "Salmonella Typhi H", "unit": "", "range": "<1:80"}]' },
    { id: 38, name: "Blood Culture & Sensitivity", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Organism", "unit": "", "range": "No growth"}, {"parameter": "Sensitivity", "unit": "", "range": ""}]' },
    { id: 39, name: "Urine Culture & Sensitivity", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Organism", "unit": "", "range": "No growth"}, {"parameter": "Colony Count", "unit": "CFU/mL", "range": "<10000"}, {"parameter": "Sensitivity", "unit": "", "range": ""}]' },
    { id: 40, name: "Stool Culture", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Organism", "unit": "", "range": "Normal flora"}, {"parameter": "Sensitivity", "unit": "", "range": ""}]' },
    { id: 41, name: "H. pylori Antibody", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "H. pylori IgG", "unit": "", "range": "Negative/Positive"}]' },
    { id: 42, name: "Brucella Test", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Brucella Antibody", "unit": "", "range": "Negative/Positive"}]' },
    { id: 43, name: "TB Gene Xpert", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "MTB", "unit": "", "range": "Not Detected/Detected"}, {"parameter": "RIF Resistance", "unit": "", "range": "Not Detected/Detected"}]' },
    { id: 44, name: "Dengue NS1 Antigen", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Dengue NS1", "unit": "", "range": "Negative/Positive"}]' },
    // Urinalysis
    { id: 50, name: "Urinalysis (Dipstick)", department: "Chemistry", type: "laboratory", parameters: '[{"parameter": "Protein", "unit": "", "range": "Negative"}, {"parameter": "Glucose", "unit": "", "range": "Negative"}, {"parameter": "Ketones", "unit": "", "range": "Negative"}, {"parameter": "Blood", "unit": "", "range": "Negative"}, {"parameter": "pH", "unit": "", "range": "4.5-8.0"}, {"parameter": "Specific Gravity", "unit": "", "range": "1.005-1.030"}]' },
    { id: 51, name: "Urine Microscopy", department: "Chemistry", type: "laboratory", parameters: '[{"parameter": "RBCs", "unit": "/HPF", "range": "0-2"}, {"parameter": "WBCs", "unit": "/HPF", "range": "0-5"}, {"parameter": "Epithelial Cells", "unit": "/HPF", "range": "Few"}, {"parameter": "Casts", "unit": "", "range": "None"}, {"parameter": "Crystals", "unit": "", "range": "None"}]' },
    { id: 52, name: "Pregnancy Test (UPT/bHCG)", department: "Chemistry", type: "laboratory", parameters: '[{"parameter": "Pregnancy Test", "unit": "", "range": "Negative/Positive"}]' },
    // Stool
    { id: 55, name: "Stool Microscopy (Ova & Cysts)", department: "Microbiology", type: "laboratory", parameters: '[{"parameter": "Ova", "unit": "", "range": "Not seen"}, {"parameter": "Cysts", "unit": "", "range": "Not seen"}, {"parameter": "Occult Blood", "unit": "", "range": "Negative"}]' },
    // Serology / Immunology
    { id: 60, name: "Rheumatoid Factor (RF)", department: "Serology", type: "laboratory", parameters: '[{"parameter": "RF", "unit": "IU/mL", "range": "<14"}]' },
    { id: 61, name: "ASO Titre", department: "Serology", type: "laboratory", parameters: '[{"parameter": "ASO", "unit": "IU/mL", "range": "<200"}]' },
    { id: 62, name: "ANA (Antinuclear Antibody)", department: "Serology", type: "laboratory", parameters: '[{"parameter": "ANA", "unit": "", "range": "Negative/Positive"}, {"parameter": "Titre", "unit": "", "range": ""}]' },
    // Cardiac
    { id: 65, name: "ECG/EKG", department: "Cardiology", type: "laboratory", parameters: '[{"parameter": "Heart Rate", "unit": "bpm", "range": "60-100"}, {"parameter": "Rhythm", "unit": "", "range": "Normal Sinus"}, {"parameter": "Interpretation", "unit": "", "range": "Normal/Abnormal"}]' },
    // Imaging
    { id: 70, name: "Chest X-ray", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Findings", "unit": "", "range": "Normal/Abnormal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 71, name: "Abdominal Ultrasound", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Liver", "unit": "", "range": "Normal"}, {"parameter": "Spleen", "unit": "", "range": "Normal"}, {"parameter": "Kidneys", "unit": "", "range": "Normal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 72, name: "Pelvic Ultrasound", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Uterus", "unit": "", "range": "Normal"}, {"parameter": "Ovaries", "unit": "", "range": "Normal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 73, name: "Obstetric Ultrasound", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Gestational Age", "unit": "weeks", "range": ""}, {"parameter": "Fetal Heart Rate", "unit": "bpm", "range": "120-160"}, {"parameter": "Presentation", "unit": "", "range": ""}, {"parameter": "Placenta", "unit": "", "range": ""}, {"parameter": "AFI", "unit": "cm", "range": "5-25"}, {"parameter": "EFW", "unit": "g", "range": ""}]' },
    { id: 74, name: "CT Scan Head", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Findings", "unit": "", "range": "Normal/Abnormal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 75, name: "MRI Brain", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Findings", "unit": "", "range": "Normal/Abnormal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 76, name: "X-ray Limb", department: "Radiology", type: "imaging", parameters: '[{"parameter": "Findings", "unit": "", "range": "Normal/Abnormal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 77, name: "Mammography", department: "Radiology", type: "imaging", parameters: '[{"parameter": "BI-RADS Category", "unit": "", "range": "1-6"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
    { id: 78, name: "Echocardiography", department: "Cardiology", type: "imaging", parameters: '[{"parameter": "EF", "unit": "%", "range": "55-70"}, {"parameter": "Valves", "unit": "", "range": "Normal"}, {"parameter": "Wall Motion", "unit": "", "range": "Normal"}, {"parameter": "Impression", "unit": "", "range": ""}]' },
  ];

  // Try to load tests from API, fallback to defaults
  useEffect(() => {
    const loadTests = async () => {
      try {
        const resp = await apiFetch("/api/investigation-tests");
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setTests(data);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to load tests from API, using defaults");
      }
      setTests(defaultTests);
    };
    loadTests();
  }, []);

  const filteredTests = tests.filter(
    (test) =>
      test.type === activeTab.toLowerCase() &&
      (test.name.toLowerCase().includes(searchQuery.toLowerCase()) || test.department.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!selectedDepartment || test.department === selectedDepartment)
  );

  const departments = [...new Set(tests.filter((t) => t.type === activeTab.toLowerCase()).map((t) => t.department))];

  const handleAddTest = (testName: string) => {
    if (!selectedTests.includes(testName)) {
      setSelectedTests([...selectedTests, testName]);
    }
    setShowDropdown(false);
    setSearchQuery("");
  };

  const handleRemoveTest = (testName: string) => {
    setSelectedTests(selectedTests.filter((t) => t !== testName));
  };

  const handleRequestInvestigations = async () => {
    if (selectedTests.length === 0 && !otherRequest) return;

    setIsSaving(true);
    try {
      const newRequests: InvestigationRequest[] = [];

      selectedTests.forEach((testName) => {
        const test = tests.find((t) => t.name === testName);
        if (test) {
          newRequests.push({
            id: Date.now() + Math.random(),
            test_id: test.id,
            department: test.department,
            type: test.type,
            status: "not_collected",
            request_notes: requestNotes,
            test: test,
            results: [],
            date_requested: new Date().toLocaleString(),
            requested_by: currentUser?.id ?? propCurrentUserId ?? 1,
          });
        }
      });

      if (otherRequest) {
        newRequests.push({
          id: Date.now() + Math.random(),
          test_id: null,
          department: null,
          type: activeTab.toLowerCase() as "laboratory" | "imaging",
          status: "not_collected",
          request_notes: requestNotes,
          custom_name: otherRequest,
          results: [],
          date_requested: new Date().toLocaleString(),
          requested_by: currentUser?.id ?? propCurrentUserId ?? 1,
        });
      }

      // Optionally persist immediately to backend
      try {
        // build payload that matches backend expectation (array of requests)
        const payload = newRequests.map((nr) => ({
          encounter_id: encounterId === "demo-encounter-123" ? 3 : parseInt(String(encounterId)),
          test_id: nr.test_id,
          test_name: nr.test_id ? undefined : nr.custom_name ?? nr.test?.name ?? null,
          department: nr.department,
          type: nr.type,
          status: nr.status,
          request_notes: nr.request_notes,
          requested_by: nr.requested_by,
          date_requested: new Date().toISOString(),
        }));

        const resp = await apiFetch("/api/investigation-requests", {
          method: "POST",
          body: JSON.stringify({ requests: payload }),
        });

        if (resp.ok) {
          const json = await resp.json();
          // merge created rows (use returned data if any)
          const created = Array.isArray(json.data) ? json.data : [];
          setRequests((prev) => [...prev, ...created]);
        } else {
          // fallback: keep locally
          setRequests((prev) => [...prev, ...newRequests]);
        }
      } catch (err) {
        console.warn("Failed to persist requests, keeping locally:", err);
        setRequests((prev) => [...prev, ...newRequests]);
      }

      setSaveMessage("Request added successfully");
      setShowSuccessToast(true);
      setSelectedTests([]);
      setOtherRequest("");
      setRequestNotes("");
      setTimeout(() => setShowSuccessToast(false), 3000);
      setIsSaving(false);
    } catch (error) {
      console.error("Failed to add request:", error);
      setIsSaving(false);
    }
  };

  const toggleResultExpansion = (requestId: number) => {
    setExpandedResults((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  };

  const toggleTestItemExpansion = (key: string) => {
    setExpandedTestItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleResultInput = (key: string, value: string) => {
    setResultInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveResults = async (requestId: number) => {
    setIsSaving(true);
    let actualRequestId: number;

    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        throw new Error("Request not found");
      }

      // If mock id -> persist request first
      if (requestId > 1000000000000 || String(requestId).includes(".")) {
        const requestPayload = {
          encounter_id: encounterId === "demo-encounter-123" ? 3 : parseInt(String(encounterId)),
          test_name: request.custom_name || (request.test ? request.test.name : null),
          department: request.department,
          type: request.type,
          status: "collected",
          request_notes: request.request_notes,
          requested_by: currentUser?.id ?? propCurrentUserId ?? 1,
          date_requested: new Date().toISOString(),
        };

        const requestResponse = await apiFetch("/api/investigation-requests", {
          method: "POST",
          body: JSON.stringify({ requests: [requestPayload] }),
        });

        if (!requestResponse.ok) {
          const text = await requestResponse.text();
          throw new Error(text || "Failed to save investigation request");
        }

        const savedRequestJson = await requestResponse.json();
        const savedRequest = Array.isArray(savedRequestJson.data) && savedRequestJson.data.length > 0 ? savedRequestJson.data[0] : savedRequestJson.data;
        actualRequestId = savedRequest?.id || savedRequestJson?.id;
        // update local state to replace mock id with actual id
        setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, id: actualRequestId } : req)));
      } else {
        actualRequestId = Math.floor(requestId);
      }

      const resultsToSave: ResultToSave[] = [];

      if (request.custom_name) {
        const resultValue = resultInputs[`${requestId}-result`];
        if (resultValue && resultValue.trim()) {
          resultsToSave.push({
            request_id: actualRequestId,
            parameter: request.custom_name,
            value: resultValue.trim(),
            unit: null,
            reference_range: null,
            flag: null,
            notes: resultInputs[`${requestId}-notes`] || null,
            entered_by: currentUser?.id ?? propCurrentUserId ?? 1,
            date_entered: new Date().toISOString(),
          });
        }
      } else if (request.test && request.test.parameters) {
        try {
          const parameters = JSON.parse(request.test.parameters);
          parameters.forEach((param: any) => {
            const parameterValue = resultInputs[`${requestId}-${param.parameter}`];
            if (parameterValue && parameterValue.trim()) {
              resultsToSave.push({
                request_id: actualRequestId,
                parameter: param.parameter,
                value: parameterValue.trim(),
                unit: param.unit || null,
                reference_range: param.range || null,
                flag: null,
                notes: resultInputs[`${requestId}-notes`] || null,
                entered_by: currentUser?.id ?? propCurrentUserId ?? 1,
                date_entered: new Date().toISOString(),
              });
            }
          });
        } catch (e) {
          console.error("Error parsing parameters:", e);
          throw new Error("Invalid test parameters format");
        }
      }

      if (resultsToSave.length === 0) {
        throw new Error("No results to save - please enter at least one result value");
      }

      // save results
      const response = await apiFetch(`/api/investigation-requests/${actualRequestId}/results`, {
        method: "POST",
        body: JSON.stringify({
          results: resultsToSave,
          additional_notes: resultInputs[`${requestId}-notes`] || null,
          status: "results_posted",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || "Unknown error";
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const savedData = await response.json();

      // Update local state with results and status
      setRequests((prev) =>
        prev.map((req) => {
          if (req.id === requestId || req.id === actualRequestId) {
            return {
              ...req,
              results:
                savedData.results ||
                resultsToSave.map((result, index) => ({
                  id: Date.now() + index,
                  parameter: result.parameter,
                  value: result.value,
                  unit: result.unit,
                  reference_range: result.reference_range,
                  flag: result.flag,
                })),
              status: "results_posted",
            };
          }
          return req;
        })
      );

      // clear resultInputs for this request
      Object.keys(resultInputs).forEach((key) => {
        if (key.startsWith(`${requestId}-`)) {
          setResultInputs((prev) => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        }
      });

      setSaveMessage("Results saved successfully");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error("Failed to save results:", error);
      setSaveMessage(`Failed to save results: ${error instanceof Error ? error.message : "Unknown error"}`);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim()) {
      setShowDropdown(true);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowDropdown(e.target.value.trim().length > 0);
  };

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      requested: "bg-yellow-100 text-yellow-800",
      not_collected: "bg-red-100 text-red-800",
      collected: "bg-blue-100 text-blue-800",
      results_posted: "bg-green-100 text-green-800",
    };

    const statusText = {
      requested: "Requested",
      not_collected: "Not collected",
      collected: "Collected",
      results_posted: "Results posted",
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses[status as keyof typeof statusClasses]}`}>
        {statusText[status as keyof typeof statusText]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <button className="text-gray-600 hover:text-gray-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-semibold text-gray-900">Investigations</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {currentUser?.name ? currentUser.name.split(" ").map((s:string)=>s[0]).slice(0,2).join("") : "JM"}
            </div>
          </div>
        </div>

        <div className="p-3">
          {/* Alert */}
          <div className="bg-red-50 border-l-2 border-red-400 p-2 mb-4 flex items-start space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div className="text-red-700 text-xs">
              <span className="font-semibold">Attention:</span> Add a diagnosis to use this page.
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-4 mb-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("Laboratory")}
              className={`px-0 py-1 text-xs font-medium border-b-2 ${activeTab === "Laboratory" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Laboratory
            </button>
            <button
              onClick={() => setActiveTab("Imaging")}
              className={`px-0 py-1 text-xs font-medium border-b-2 ${activeTab === "Imaging" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Imaging
            </button>
          </div>

          {/* Selected Tests */}
          {selectedTests.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedTests.map((test, index) => (
                <div key={index} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs flex items-center space-x-1">
                  <span>{test}</span>
                  <button onClick={() => handleRemoveTest(test)} className="text-blue-600 hover:text-blue-800">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Search by name/dept*</label>
              <button className="text-xs text-blue-600 hover:text-blue-800">View investigations</button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            {showDropdown && searchQuery && (
              <div className="mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                <div className="p-2 text-xs text-gray-600 bg-gray-50 border-b">Showing results for:</div>
                {filteredTests.length > 0 ? (
                  filteredTests.map((test) => (
                    <button key={test.id} onClick={() => handleAddTest(test.name)} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 text-xs text-gray-700">
                      {test.name}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-gray-500">No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Other Request */}
          <div className="mb-4">
            <label className="flex items-center text-xs font-medium text-gray-700 mb-1">
              Other request
              <Info className="w-3 h-3 ml-1 text-gray-400" />
            </label>
            <input
              type="text"
              placeholder="Describe investigation"
              value={otherRequest}
              onChange={(e) => setOtherRequest(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <label className="block text-xs font-medium text-gray-700 mt-2 mb-1">Notes</label>
            <textarea
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              rows={2}
            />
          </div>

          {/* Request Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={handleRequestInvestigations}
              disabled={isSaving || (selectedTests.length === 0 && !otherRequest)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isSaving ? "Requesting..." : "Request"}
            </button>
          </div>

          {/* Lab Results */}
          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Lab results</h2>
            {requests.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No requests yet.</div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-md bg-white">
                    <div className="flex items-start justify-between p-3 border-b border-gray-200">
                      <div className="flex items-start space-x-2">
                        <button onClick={() => toggleResultExpansion(request.id)} className="text-gray-400 hover:text-gray-600 mt-0.5">
                          {expandedResults[request.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{request.custom_name || (request.test ? request.test.name : "Unknown")}</div>
                          <div className="text-xs text-gray-500">Date: {request.date_requested || "Unknown"}</div>
                          <div className="text-xs text-gray-500">Notes: {request.request_notes || "None"}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(request.status)}
                        <span className="text-xs text-gray-600">{request.requested_by}</span>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {expandedResults[request.id] && (
                      <div className="p-3">
                        <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <button onClick={() => toggleTestItemExpansion(`request-${request.id}`)} className="text-gray-400 hover:text-gray-600">
                                {expandedTestItems[`request-${request.id}`] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              <span className="text-xs font-medium text-gray-700">{request.custom_name || (request.test ? request.test.name : "Unknown")}</span>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                          {expandedTestItems[`request-${request.id}`] && (
                            <div className="ml-6 mt-2 bg-gray-50 rounded-md p-3">
                              <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Results</label>
                                {request.custom_name && (
                                  <input
                                    type="text"
                                    placeholder="Enter results"
                                    value={resultInputs[`${request.id}-result`] || ""}
                                    onChange={(e) => handleResultInput(`${request.id}-result`, e.target.value)}
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  />
                                )}
                                {request.test && request.test.parameters && (
                                  <div className="space-y-2">
                                    {(() => {
                                      try {
                                        const parameters = JSON.parse(request.test.parameters);
                                        return parameters.map((param: any, index: number) => (
                                          <div key={index} className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-700 w-32">{param.parameter}:</span>
                                            <input
                                              type="text"
                                              placeholder={`Value (${param.unit})`}
                                              value={resultInputs[`${request.id}-${param.parameter}`] || ""}
                                              onChange={(e) => handleResultInput(`${request.id}-${param.parameter}`, e.target.value)}
                                              className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            />
                                            <span className="text-xs text-gray-500 w-24">Ref: {param.range}</span>
                                          </div>
                                        ));
                                      } catch (e) {
                                        return (
                                          <input
                                            type="text"
                                            placeholder="Enter results"
                                            value={resultInputs[`${request.id}-result`] || ""}
                                            onChange={(e) => handleResultInput(`${request.id}-result`, e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                          />
                                        );
                                      }
                                    })()}
                                  </div>
                                )}
                              </div>
                              <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                                <input
                                  type="text"
                                  value={resultInputs[`${request.id}-notes`] || ""}
                                  onChange={(e) => handleResultInput(`${request.id}-notes`, e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                  <div className="text-xs font-medium text-gray-700">Requested by</div>
                                  <div className="text-xs text-gray-600">{request.requested_by} on {request.date_requested}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-gray-700">Performed by</div>
                                  <div className="text-xs text-gray-600">-</div>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleSaveResults(request.id)}
                                  disabled={isSaving}
                                  className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50 text-xs font-medium"
                                >
                                  {isSaving ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {showSuccessToast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-4 right-4 w-64 bg-white border-l-2 border-green-600 shadow-md rounded-md px-2 py-1.5 flex items-center z-50"
            >
              <CheckCircle className="text-green-600 w-3 h-3 flex-shrink-0" />
              <div className="ml-1.5 flex-1">
                <div className="font-semibold text-green-700 text-xs">Success</div>
                <div className="text-gray-700 text-xs">{saveMessage}</div>
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 3, ease: "linear" }}
                  className="h-0.5 bg-green-600 mt-1 rounded-full"
                />
              </div>
              <button onClick={() => setShowSuccessToast(false)} className="ml-1.5 text-gray-500 hover:text-gray-700">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InvestigationPage;
