# Design Document — Ultra-Robust HMS

## Overview

This document describes the technical design for completing and extending the Kenya-based Hospital Management System (HMS). The system is deployed at `hospital-mu-azure.vercel.app` and consists of a React 18 + Vite + TypeScript frontend and an Express + Sequelize + PostgreSQL (Supabase) backend.

The design covers ten new or enhanced modules:

1. **Clinical Encounter Workflow** — Complaints/HPI, Structured Forms, ROS, Medication History, Physical Exam, Diagnosis/ICD-10, Prescription, Appointment booking, Patient Bills
2. **Reports Module** — Clinical, Financial, Inventory, Patient reports with PDF/CSV export
3. **Messaging Module** — Africa's Talking SMS/WhatsApp compose, bulk, templates, history
4. **Expense Management** — CRUD expenses, budget vs. actual charts
5. **Pharmacy Module** — Prescription queue, dispensing, formulary management
6. **Ward/IPD Module** — Ward/bed management, admissions, ward notes, discharge
7. **Laboratory Enhancement** — Full worklist, sample collection, result entry, validation, printing
8. **SHA/NHIF Insurance Module** — Patient insurance, pre-auth, claims management
9. **Admin Panel** — User management, roles/permissions, audit log, system settings
10. **Enhanced Dashboard** — Real-time stats, alerts, activity feed

All monetary values are in Kenya Shillings (KES). The system integrates with M-Pesa (Daraja STK Push), Africa's Talking SMS, and Kenya's SHA/NHIF insurance schemes.

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel Edge                              │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │  React 18 + Vite SPA │    │  Express API (api/[...all].ts│   │
│  │  (packages/frontend) │◄──►│  packages/backend)           │   │
│  └──────────────────────┘    └──────────────┬───────────────┘   │
└─────────────────────────────────────────────┼───────────────────┘
                                              │
                    ┌─────────────────────────┼──────────────────┐
                    │                         │                  │
              ┌─────▼──────┐    ┌─────────────▼──┐  ┌──────────▼──┐
              │  Supabase  │    │  Africa's      │  │  Safaricom  │
              │ PostgreSQL │    │  Talking SMS   │  │  Daraja API │
              └────────────┘    └────────────────┘  └─────────────┘
```

### Request Flow

1. Frontend makes authenticated requests with `Authorization: Bearer <hms_token>` header
2. Express middleware validates JWT and attaches `req.user`
3. Route handlers call controllers which execute raw SQL via `sequelize.query()` (matching existing pattern)
4. Controllers return JSON; frontend React Query cache is invalidated on mutations

### Authentication

JWT stored in `localStorage` as `hms_token`. All new API routes use the existing `auth` middleware from `packages/backend/src/middleware/auth.ts`.

---

## Components and Interfaces

### Backend Route Structure

All new routes follow the existing pattern: a Router file in `src/routes/` that imports from a controller in `src/controllers/` (to be created), registered in `server.ts`.

```
packages/backend/src/
├── data/
│   └── icd10_kenya.json              ← 250 ICD-10 codes (static seed)
├── routes/
│   ├── encounterClinicalRoutes.ts    ← HPI, ROS, exam, diagnosis, prescription
│   ├── icd10Routes.ts                ← ICD-10 search
│   ├── pharmacyRoutes.ts             ← dispensing queue
│   ├── wardRoutes.ts                 ← ward/bed management
│   ├── admissionRoutes.ts            ← admissions/discharge/notes
│   ├── labRoutes.ts                  ← lab worklist/results
│   ├── insuranceRoutes.ts            ← schemes/patient insurance
│   ├── claimRoutes.ts                ← claims management
│   ├── reportRoutes.ts               ← all reports
│   ├── messagingRoutes.ts            ← SMS sending
│   ├── expenseRoutes.ts              ← expense CRUD
│   ├── budgetRoutes.ts               ← budget management
│   ├── adminRoutes.ts                ← users/roles/audit
│   └── dashboardRoutes.ts            ← stats/alerts/activity
├── controllers/
│   ├── encounterClinicalController.ts
│   ├── pharmacyController.ts
│   ├── wardController.ts
│   ├── admissionController.ts
│   ├── labController.ts
│   ├── insuranceController.ts
│   ├── claimController.ts
│   ├── reportController.ts
│   ├── messagingController.ts
│   ├── expenseController.ts
│   ├── adminController.ts
│   └── dashboardController.ts
└── services/
    └── smsService.ts                 ← Africa's Talking wrapper
```

### Frontend Component Structure

```
packages/frontend/src/
├── pages/
│   ├── ReportsPage.tsx
│   ├── MessagingPage.tsx             ← replace stub
│   ├── ExpenseHistoryPage.tsx        ← already exists, enhance
│   ├── ExpenseSummaryPage.tsx        ← already exists, enhance
│   ├── PharmacyPage.tsx
│   ├── WardManagementPage.tsx
│   ├── AdmissionsPage.tsx
│   ├── AdmissionDetailPage.tsx
│   ├── InsurancePage.tsx
│   ├── AdminPanelPage.tsx            ← replace stub
│   └── LabWorklist.tsx
├── components/
│   ├── encounter/
│   │   ├── ComplaintsHPI.tsx
│   │   ├── StructuredVisitForms.tsx
│   │   ├── ReviewOfSystems.tsx
│   │   ├── MedicationHistory.tsx
│   │   ├── PhysicalExamination.tsx
│   │   ├── DiagnosisAndPlan.tsx
│   │   ├── PrescriptionForm.tsx
│   │   ├── EncounterAppointment.tsx
│   │   └── PatientBills.tsx
│   ├── ICD10Search.tsx
│   ├── DateRangePicker.tsx
│   ├── ExportButtons.tsx
│   ├── AlertsPanel.tsx
│   └── ActivityFeed.tsx
```

### API Interface Contracts

#### Clinical Encounter Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/encounters/:id/hpi` | Save HPI |
| GET | `/api/encounters/:id/hpi` | Get HPI |
| POST | `/api/encounters/:id/structured-forms` | Save structured visit form |
| GET | `/api/encounters/:id/structured-forms` | Get structured forms |
| POST | `/api/encounters/:id/ros` | Save ROS |
| GET | `/api/encounters/:id/ros` | Get ROS |
| POST | `/api/patients/:id/medication-history` | Save medication history |
| GET | `/api/patients/:id/medication-history` | Get medication history |
| POST | `/api/patients/:id/allergies` | Add allergy |
| GET | `/api/patients/:id/allergies` | Get allergies |
| DELETE | `/api/patients/:id/allergies/:allergyId` | Remove allergy |
| POST | `/api/encounters/:id/examination` | Save physical exam |
| GET | `/api/encounters/:id/examination` | Get physical exam |
| POST | `/api/encounters/:id/diagnoses` | Save diagnoses |
| GET | `/api/encounters/:id/diagnoses` | Get diagnoses |
| GET | `/api/icd10/search?q=malaria` | Search ICD-10 codes |
| POST | `/api/encounters/:id/prescriptions` | Create prescription |
| GET | `/api/encounters/:id/prescriptions` | Get prescriptions |
| PATCH | `/api/prescriptions/:id/status` | Update prescription status |
| POST | `/api/encounters/:id/bills` | Generate bill from encounter |

#### Other Module Endpoints

All other endpoints follow the same REST conventions as documented in the requirements. Full list in the Data Models section below.

---

## Data Models

### New Database Tables

All new tables use the `hms_` prefix and follow the existing PostgreSQL schema conventions.

#### Clinical Tables

```sql
-- History of Present Illness
CREATE TABLE hms_hpi (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  onset TEXT,
  character TEXT,
  radiation TEXT,
  associated_symptoms TEXT,
  timing TEXT,
  exacerbating_factors TEXT,
  relieving_factors TEXT,
  narrative TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Structured Visit Forms (ANC, PNC, CWC, FP, HIV/TB)
CREATE TABLE hms_structured_visit_forms (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  form_type VARCHAR(50) NOT NULL,  -- ANC, PNC, CWC, FP, HIV_TB
  form_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review of Systems
CREATE TABLE hms_review_of_systems (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  ros_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medication History (patient-level, not encounter-level)
CREATE TABLE hms_medication_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  current_medications JSONB DEFAULT '[]',
  past_medical_history TEXT,
  surgical_history TEXT,
  family_history TEXT,
  social_history JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allergies
CREATE TABLE hms_allergies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  allergen VARCHAR(255) NOT NULL,
  allergy_type VARCHAR(50) DEFAULT 'Drug',  -- Drug, Food, Environmental
  reaction_type VARCHAR(255),
  severity VARCHAR(50) DEFAULT 'Mild',      -- Mild, Moderate, Severe
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Physical Examination
CREATE TABLE hms_physical_examination (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  general_appearance TEXT,
  heent TEXT,
  neck TEXT,
  chest_lungs TEXT,
  heart TEXT,
  abdomen TEXT,
  extremities TEXT,
  neurological TEXT,
  skin TEXT,
  exam_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagnoses (ICD-10)
CREATE TABLE hms_diagnoses (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  icd10_code VARCHAR(20) NOT NULL,
  icd10_description TEXT NOT NULL,
  diagnosis_type VARCHAR(20) DEFAULT 'Primary',  -- Primary, Secondary
  clinical_notes TEXT,
  management_plan TEXT,
  follow_up_instructions TEXT,
  referral_type VARCHAR(50),   -- Internal, External, None
  referral_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescriptions
CREATE TABLE hms_prescriptions (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  prescriber_id INTEGER NOT NULL REFERENCES hms_staff(id),
  status VARCHAR(50) DEFAULT 'Pending',  -- Pending, Dispensed, Cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescription Items
CREATE TABLE hms_prescription_items (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER NOT NULL REFERENCES hms_prescriptions(id) ON DELETE CASCADE,
  drug_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  route VARCHAR(100) DEFAULT 'Oral',
  instructions TEXT,
  quantity_prescribed INTEGER DEFAULT 1,
  stock_id UUID REFERENCES hms_stock(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Ward/IPD Tables

```sql
CREATE TABLE hms_wards (
  id SERIAL PRIMARY KEY,
  ward_name VARCHAR(100) NOT NULL,
  ward_type VARCHAR(50) NOT NULL,  -- Medical, Surgical, Maternity, Pediatric, ICU
  total_beds INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_beds (
  id SERIAL PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES hms_wards(id) ON DELETE CASCADE,
  bed_number VARCHAR(20) NOT NULL,
  status VARCHAR(30) DEFAULT 'Vacant',  -- Vacant, Occupied, Reserved, Maintenance
  current_admission_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

CREATE TABLE hms_admissions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  encounter_id INTEGER REFERENCES hms_encounters(id),
  ward_id INTEGER NOT NULL REFERENCES hms_wards(id),
  bed_id INTEGER NOT NULL REFERENCES hms_beds(id),
  admitting_clinician_id INTEGER NOT NULL REFERENCES hms_staff(id),
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admitting_diagnosis TEXT,
  discharge_date TIMESTAMPTZ,
  discharge_diagnosis TEXT,
  discharge_summary TEXT,
  discharge_medications JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'Admitted',  -- Admitted, Discharged, Transferred
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_ward_notes (
  id SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL REFERENCES hms_admissions(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  clinician_id INTEGER REFERENCES hms_staff(id),
  clinician_name VARCHAR(255),
  note_type VARCHAR(50) DEFAULT 'Ward Round',  -- Ward Round, Nursing, Progress
  observations TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Insurance Tables

```sql
CREATE TABLE hms_insurance_schemes (
  id SERIAL PRIMARY KEY,
  scheme_name VARCHAR(100) NOT NULL,  -- SHA, NHIF, Private
  scheme_code VARCHAR(50),
  benefit_packages JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_patient_insurance (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  scheme_id INTEGER REFERENCES hms_insurance_schemes(id),
  sha_number VARCHAR(100),
  nhif_number VARCHAR(100),
  member_number VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_claims (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id),
  scheme_id INTEGER NOT NULL REFERENCES hms_insurance_schemes(id),
  claim_number VARCHAR(100) UNIQUE,
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  approved_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Draft',  -- Draft, Submitted, Approved, Rejected, Paid
  submission_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  rejection_reason TEXT,
  pre_auth_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_claim_items (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL REFERENCES hms_claims(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  service_code VARCHAR(50),
  quantity INTEGER DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Admin Tables

```sql
CREATE TABLE hms_audit_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,   -- CREATE, UPDATE, DELETE, LOGIN, LOGOUT
  resource_name VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  user_id INTEGER,
  user_name VARCHAR(255),
  user_role VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hms_budget (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  period VARCHAR(20) NOT NULL,  -- YYYY-MM
  budget_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, period)
);
```

### Key Data Flows

#### 1. Complete Clinical Encounter Flow

```
Patient arrives → Triage (vitals) → Encounter created →
  Complaints & HPI → Review of Systems → Medication History →
  Physical Examination → Investigations requested →
  Lab results entered → Diagnosis & Plan (ICD-10) →
  Prescription written → Patient Bills generated →
  Payment processed (Cash/M-Pesa) → Appointment booked →
  Encounter closed
```

#### 2. Prescription → Pharmacy Dispensing Flow

```
Clinician saves prescription (status: Pending) →
Pharmacist sees it in queue →
Pharmacist opens prescription →
Pharmacist marks each item as Dispensed →
Stock quantity decremented in hms_stock →
Prescription status → Dispensed →
Patient notified via SMS (optional)
```

#### 3. SHA/NHIF Claim Flow

```
Encounter completed →
Billing officer opens encounter →
System auto-populates claim items from services/investigations/drugs →
Billing officer reviews and submits claim →
Claim status: Submitted →
SHA/NHIF processes claim →
Billing officer updates status to Approved/Rejected/Paid →
Invoice balance updated
```

#### 4. Ward Admission Flow

```
Clinician decides patient needs admission →
Opens Ward Management →
Selects available bed →
Creates admission record →
Bed status → Occupied →
Nurses record ward round notes daily →
Clinician discharges patient →
Discharge summary generated →
Bed status → Vacant
```

### ICD-10 Seed Data

A static JSON file at `packages/backend/src/data/icd10_kenya.json` contains 250 common Kenya diagnoses. The `/api/icd10/search` endpoint reads this file and filters by query string (case-insensitive substring match on code or description). This avoids a database round-trip for a read-only reference dataset.

Categories covered: Infectious (Malaria, Typhoid, HIV, TB, Cholera), Respiratory (Pneumonia, Asthma, URTI), Cardiovascular (Hypertension, Heart failure, Anaemia), Endocrine (Diabetes T1/T2, Malnutrition), GI (Gastroenteritis, Peptic ulcer), Obstetric (ANC, Delivery, Pre-eclampsia), Paediatric, Mental Health, Injuries, and Other (UTI, Skin, Eye infections).

---

## Error Handling

### Backend Error Strategy

All controllers follow this pattern:

```typescript
export const someController = async (req: Request, res: Response) => {
  try {
    // Validate required references (encounter_id, patient_id, etc.)
    const [encounter] = await sequelize.query(
      'SELECT id FROM hms_encounters WHERE id = $1',
      { bind: [req.params.id], type: QueryTypes.SELECT }
    );
    if (!encounter) return res.status(404).json({ message: 'Encounter not found' });

    // Business rule validation
    // e.g., stock check before dispensing

    // Execute operation
    const [result] = await sequelize.query('INSERT INTO ...', { bind: [...] });
    res.status(201).json(result);
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
```

### HTTP Status Codes

| Scenario | Status |
|----------|--------|
| Resource not found (encounter, patient, bed) | 404 |
| Invalid reference (encounter_id not in hms_encounters) | 422 |
| Business rule violation (bed occupied, stock negative, claim exceeds limit) | 409 |
| Validation error (missing required field) | 400 |
| Server/DB error | 500 |

### Frontend Error Handling

- React Query `onError` callbacks display `toast.error()` notifications (matching existing BillingPage pattern)
- Form validation uses controlled state with inline error messages before API submission
- Loading states use `Loader2` spinner from Lucide React (matching existing pattern)
- Optimistic updates are avoided for financial/clinical operations; always wait for server confirmation

### Africa's Talking SMS Errors

If the AT API returns an error, the system logs the failure to the SMS history record with `status: 'Failed'` and `error_reason` field, and displays a toast error to the user. The UI does not retry automatically — the user can resend from the History tab.

### M-Pesa STK Push Errors

STK Push failures (timeout, user cancellation, insufficient funds) are handled by polling the Daraja transaction status endpoint. The invoice status remains `unpaid` until a confirmed `ResultCode: 0` callback is received.

---

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit/integration tests for specific scenarios with property-based tests for universal correctness properties.

**Unit/Integration Tests** cover:
- Specific API endpoint responses with known inputs
- Edge cases: empty inputs, missing references, boundary values
- Integration points: M-Pesa callback handling, Africa's Talking response parsing

**Property-Based Tests** cover:
- Universal invariants that must hold across all valid inputs
- Financial calculations (bill totals, claim amounts)
- Stock quantity constraints
- Data round-trips (structured form JSON serialization)

### Property-Based Testing Library

The project uses **fast-check** (`fc`) for TypeScript property-based testing, consistent with the existing backend TypeScript stack.

```
npm install --save-dev fast-check
```

Test file: `packages/backend/src/tests/correctness.test.ts`

Each property test runs a minimum of **100 iterations** (fast-check default). Tests are tagged with:

```typescript
// Feature: ultra-robust-hms, Property N: <property_text>
```

### Unit Test Coverage Targets

- All new API endpoints: happy path + 404/422/409 error cases
- Prescription reference validation (encounter_id, patient_id)
- Stock dispensing transaction rollback on negative quantity
- Bed exclusivity enforcement
- Claim amount cap against scheme benefit limit
- Bill total calculation with multiple line items


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The following properties are derived from the acceptance criteria in the requirements document. Each is universally quantified and implementable as a property-based test using **fast-check**.

---

### Property 1: Bill Total Invariant

*For any* set of invoice line items with non-negative amounts, the bill total stored in `hms_invoices` SHALL equal the arithmetic sum of all individual line item amounts, within floating-point tolerance (±0.01 KES).

**Validates: Requirements 9.4, 19.2**

---

### Property 2: Stock Non-Negative After Dispensing

*For any* initial stock quantity and any dispensed quantity, if the dispensed quantity does not exceed the initial quantity, the resulting stock quantity SHALL be greater than or equal to zero. If the dispensed quantity exceeds the initial quantity, the dispensing operation SHALL be rejected before any state change is committed.

**Validates: Requirements 13.4, 19.5**

---

### Property 3: Bed Exclusivity

*For any* bed in `hms_beds`, there SHALL be at most one active admission record in `hms_admissions` referencing that bed at any point in time. Any attempt to create a second active admission for an already-occupied bed SHALL be rejected with a conflict error.

**Validates: Requirements 14.4, 19.3**

---

### Property 4: Claim Amount Cap

*For any* insurance claim and any configured scheme benefit limit, the claimable amount recorded in `hms_claims` SHALL be at most the benefit limit for the patient's scheme. The effective claimed amount SHALL equal `min(requested_amount, benefit_limit)`.

**Validates: Requirements 16.5, 19.4**

---

### Property 5: Prescription Reference Validity

*For any* prescription save request, if either the `encounter_id` does not exist in `hms_encounters` or the `patient_id` does not exist in `hms_patients`, the system SHALL reject the request with HTTP 422 and no prescription record SHALL be created.

**Validates: Requirements 19.1**

---

### Property 6: Investigation Result Reference Validity

*For any* investigation result save request, if the `request_id` does not exist in `hms_investigation_requests`, the system SHALL reject the request with HTTP 422 and no result record SHALL be created.

**Validates: Requirements 19.6**

---

### Property 7: Structured Visit Form JSON Round-Trip

*For any* structured visit form data object (with arbitrary nested fields of type string, number, boolean, or array), serialising the object to JSONB and deserialising it back SHALL produce a value that deep-equals the original object. No data SHALL be lost or mutated through the storage round-trip.

**Validates: Requirements 19.7, 2.5, 2.7**

---

### Property 8: Investigation Result Storage Round-Trip

*For any* valid investigation result record (with arbitrary parameter values, result values, and flags), saving the result to `hms_investigation_results` and then retrieving it by `request_id` SHALL produce a record whose fields deep-equal the saved values.

**Validates: Requirements 15.9**

---

### Property 9: ICD-10 Search Filter Correctness

*For any* search query string of two or more characters, every ICD-10 entry returned by the search endpoint SHALL contain the query string (case-insensitive) in either the `icd10_code` or the `icd10_description` field. No entry that does not match the query SHALL appear in the results.

**Validates: Requirements 6.1**

---

### Property 10: SMS History Logging Round-Trip

*For any* SMS send operation with a given recipient phone number and message body, the resulting history record in the SMS log SHALL contain the exact recipient phone number, the exact message body, and a non-null timestamp. The status SHALL be either `Sent`, `Delivered`, or `Failed` — never null or undefined.

**Validates: Requirements 11.3**

---

### Property-Based Test Implementation

```typescript
// packages/backend/src/tests/correctness.test.ts
import * as fc from 'fast-check';

// Feature: ultra-robust-hms, Property 1: Bill total equals sum of line items
test('bill total equals sum of line items', () => {
  fc.assert(fc.property(
    fc.array(
      fc.record({ amount: fc.float({ min: 0, max: 100000, noNaN: true }) }),
      { minLength: 1, maxLength: 50 }
    ),
    (items) => {
      const expectedTotal = items.reduce((sum, i) => sum + i.amount, 0);
      const bill = createBill(items);
      return Math.abs(bill.total - expectedTotal) < 0.01;
    }
  ), { numRuns: 100 });
});

// Feature: ultra-robust-hms, Property 2: Stock never goes negative
test('stock never goes negative after dispensing', () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: 10000 }),
    fc.integer({ min: 0, max: 10000 }),
    (initialQty, dispensedQty) => {
      if (dispensedQty > initialQty) {
        // Must be rejected
        expect(() => dispense(initialQty, dispensedQty)).toThrow();
        return true;
      }
      const result = dispense(initialQty, dispensedQty);
      return result >= 0;
    }
  ), { numRuns: 100 });
});

// Feature: ultra-robust-hms, Property 4: Claim amount cap
test('claim amount never exceeds scheme benefit limit', () => {
  fc.assert(fc.property(
    fc.float({ min: 0, max: 1000000, noNaN: true }),
    fc.float({ min: 0, max: 1000000, noNaN: true }),
    (requestedAmount, benefitLimit) => {
      const effective = capClaimAmount(requestedAmount, benefitLimit);
      return effective <= benefitLimit && effective <= requestedAmount;
    }
  ), { numRuns: 100 });
});

// Feature: ultra-robust-hms, Property 7: Structured form JSON round-trip
test('structured visit form JSON round-trip preserves data', () => {
  fc.assert(fc.property(
    fc.object({ maxDepth: 3 }),
    (formData) => {
      const serialised = JSON.stringify(formData);
      const deserialised = JSON.parse(serialised);
      return JSON.stringify(deserialised) === JSON.stringify(formData);
    }
  ), { numRuns: 100 });
});

// Feature: ultra-robust-hms, Property 9: ICD-10 search filter correctness
test('ICD-10 search returns only matching entries', () => {
  fc.assert(fc.property(
    fc.string({ minLength: 2, maxLength: 20 }),
    (query) => {
      const results = searchICD10(icd10Data, query);
      return results.every(entry =>
        entry.code.toLowerCase().includes(query.toLowerCase()) ||
        entry.description.toLowerCase().includes(query.toLowerCase())
      );
    }
  ), { numRuns: 100 });
});
```
