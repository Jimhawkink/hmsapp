# Implementation Plan: Ultra-Robust HMS

## Overview

This plan converts the HMS design into incremental coding tasks, grouped into 16 phases. Each phase builds on the previous, ending with full integration. All backend routes use raw SQL via `sequelize.query()`. All new DB tables use the `hms_` prefix. Frontend pages match the existing gradient-header + card-based Tailwind UI style.

## Tasks

- [x] 1. Database Schema Migrations
  - [x] 1.1 Create clinical tables migration file
    - Create `packages/backend/src/migrations/001_create_hms_clinical_tables.sql`
    - Include: `hms_hpi`, `hms_structured_visit_forms`, `hms_review_of_systems`, `hms_medication_history`, `hms_allergies`, `hms_physical_examination`, `hms_diagnoses`, `hms_prescriptions`, `hms_prescription_items`
    - Add all foreign key constraints referencing `hms_encounters`, `hms_patients`, `hms_staff`, `hms_stock`
    - _Requirements: 1.2, 2.5, 3.3, 4.2, 5.4, 6.4, 7.4_

  - [x] 1.2 Create ward/IPD tables migration file
    - Create `packages/backend/src/migrations/002_create_hms_ward_tables.sql`
    - Include: `hms_wards`, `hms_beds` (with UNIQUE constraint on `ward_id, bed_number`), `hms_admissions`, `hms_ward_notes`
    - _Requirements: 14.2, 14.3, 14.5, 14.7_

  - [x] 1.3 Create insurance tables migration file
    - Create `packages/backend/src/migrations/003_create_hms_insurance_tables.sql`
    - Include: `hms_insurance_schemes`, `hms_patient_insurance`, `hms_claims`, `hms_claim_items`
    - Add UNIQUE constraint on `hms_claims.claim_number`
    - _Requirements: 16.1, 16.2, 16.3, 16.7_

  - [x] 1.4 Create admin/budget tables migration file
    - Create `packages/backend/src/migrations/004_create_hms_admin_tables.sql`
    - Include: `hms_audit_log`, `hms_budget` (with UNIQUE constraint on `category, period`)
    - _Requirements: 17.4, 12.8_

  - [x] 1.5 Checkpoint — Run all four migration files against the Supabase PostgreSQL database
    - Execute each `.sql` file in order (001 → 004) using the Supabase SQL editor or `psql`
    - Verify all tables exist with correct columns and constraints
    - Ensure all tests pass, ask the user if questions arise.


- [ ] 2. ICD-10 Seed Data
  - [x] 2.1 Create the ICD-10 Kenya JSON seed file
    - Create `packages/backend/src/data/icd10_kenya.json`
    - Include at least 250 entries covering: Infectious (Malaria, Typhoid, HIV, TB, Cholera), Respiratory (Pneumonia, Asthma, URTI), Cardiovascular (Hypertension, Heart failure, Anaemia), Endocrine (Diabetes T1/T2, Malnutrition), GI (Gastroenteritis, Peptic ulcer), Obstetric (ANC, Delivery, Pre-eclampsia), Paediatric, Mental Health, Injuries, and Other (UTI, Skin, Eye infections)
    - Each entry: `{ "code": "A00", "description": "Cholera" }`
    - _Requirements: 6.1_

  - [x] 2.2 Create the ICD-10 search route and controller
    - Create `packages/backend/src/routes/icd10Routes.ts` with `GET /api/icd10/search?q=`
    - Implement case-insensitive substring match on `code` and `description` fields from the JSON file
    - Return results within 300 ms (in-memory filter, no DB round-trip)
    - Create `packages/backend/src/controllers/icd10Controller.ts` (inline in route file is acceptable)
    - _Requirements: 6.1, 6.2_

  - [ ]* 2.3 Write property test for ICD-10 search filter correctness
    - **Property 9: ICD-10 Search Filter Correctness**
    - **Validates: Requirements 6.1**
    - Every result returned for any query of ≥2 chars must contain the query string in `code` or `description` (case-insensitive)


- [x] 3. Backend Services & Infrastructure
  - [x] 3.1 Create the Africa's Talking SMS service
    - Create `packages/backend/src/services/smsService.ts`
    - Wrap the Africa's Talking SMS API: `sendSMS(to: string, message: string): Promise<{ status: string; messageId: string }>`
    - Read `AT_API_KEY` and `AT_USERNAME` and `AT_SENDER_ID` from environment variables
    - On API error, throw a typed error with the AT error reason so callers can log it
    - _Requirements: 11.3, 11.7, 20.6_

  - [x] 3.2 Create the audit log middleware/helper
    - Add a `logAudit(action, resource, resourceId, user, oldValues?, newValues?)` helper function in `packages/backend/src/services/auditService.ts`
    - Inserts a row into `hms_audit_log` via `sequelize.query()`
    - Import and call this helper from all create/update/delete controller operations
    - _Requirements: 17.4_

  - [x] 3.3 Checkpoint — Verify SMS service and audit helper compile without errors
    - Ensure all tests pass, ask the user if questions arise.


- [x] 4. Clinical Encounter Backend
  - [x] 4.1 Implement Complaints & HPI controller and route
    - Create `packages/backend/src/controllers/encounterClinicalController.ts`
    - Implement `saveHPI` (POST `/api/encounters/:id/hpi`) and `getHPI` (GET `/api/encounters/:id/hpi`)
    - Validate encounter exists in `hms_encounters`; return 404 if not found
    - Save to `hms_hpi` via `sequelize.query()`; associate with both `encounter_id` and `patient_id`
    - Create `packages/backend/src/routes/encounterClinicalRoutes.ts` and register these two endpoints
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 4.2 Implement Structured Visit Forms endpoints
    - Add `saveStructuredForm` (POST `/api/encounters/:id/structured-forms`) and `getStructuredForms` (GET) to `encounterClinicalController.ts`
    - Accept `form_type` (ANC/PNC/CWC/FP/HIV_TB) and `form_data` JSONB
    - Validate required fields per form type before saving
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.3 Implement Review of Systems endpoints
    - Add `saveROS` (POST `/api/encounters/:id/ros`) and `getROS` (GET) to `encounterClinicalController.ts`
    - Save `ros_data` JSONB to `hms_review_of_systems`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.4 Implement Medication History and Allergies endpoints
    - Add `saveMedicationHistory` (POST `/api/patients/:id/medication-history`), `getMedicationHistory` (GET)
    - Add `addAllergy` (POST `/api/patients/:id/allergies`), `getAllergies` (GET), `deleteAllergy` (DELETE `/api/patients/:id/allergies/:allergyId`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.5 Implement Physical Examination endpoints
    - Add `saveExamination` (POST `/api/encounters/:id/examination`) and `getExamination` (GET)
    - Save all system fields plus `exam_data` JSONB to `hms_physical_examination`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.6 Implement Diagnosis and Plan endpoints
    - Add `saveDiagnoses` (POST `/api/encounters/:id/diagnoses`) and `getDiagnoses` (GET)
    - Validate at least one ICD-10 code is provided; return 400 if not
    - Save to `hms_diagnoses` with `diagnosis_type` (Primary/Secondary), `management_plan`, `follow_up_instructions`, `referral_type`
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [x] 4.7 Implement Prescription endpoints
    - Add `createPrescription` (POST `/api/encounters/:id/prescriptions`), `getPrescriptions` (GET), `updatePrescriptionStatus` (PATCH `/api/prescriptions/:id/status`)
    - Validate `encounter_id` exists in `hms_encounters` AND `patient_id` exists in `hms_patients` before saving; return 422 if either is invalid
    - Save prescription header to `hms_prescriptions` and items to `hms_prescription_items`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 19.1_

  - [ ]* 4.8 Write property test for prescription reference validity
    - **Property 5: Prescription Reference Validity**
    - **Validates: Requirements 19.1**
    - For any prescription save with invalid `encounter_id` or `patient_id`, the system must reject with HTTP 422 and create no record

  - [x] 4.9 Implement Appointment booking from encounter endpoint
    - Add `bookAppointmentFromEncounter` (POST `/api/encounters/:id/appointments`) to `encounterClinicalController.ts`
    - Check for time-slot conflicts in `hms_appointments` before inserting; return 409 if conflict
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.10 Implement Patient Bills from encounter endpoint
    - Add `createBillFromEncounter` (POST `/api/encounters/:id/bills`) to `encounterClinicalController.ts`
    - Accept array of line items; compute total as sum of all amounts; insert into `hms_invoices`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.11 Write property test for bill total invariant
    - **Property 1: Bill Total Invariant**
    - **Validates: Requirements 9.4, 19.2**
    - For any array of non-negative line item amounts, `bill.total` must equal their arithmetic sum within ±0.01 KES

  - [x] 4.12 Checkpoint — Ensure all clinical encounter backend endpoints compile and return correct HTTP status codes
    - Ensure all tests pass, ask the user if questions arise.


- [-] 5. Clinical Encounter Frontend Components
  - [x] 5.1 Create ComplaintsHPI component
    - Create `packages/frontend/src/components/encounter/ComplaintsHPI.tsx`
    - Form fields: complaint text, duration value + unit (hours/days/weeks/months), onset, character, radiation, associated symptoms, timing, exacerbating/relieving factors, HPI narrative
    - Use React Query mutation to POST to `/api/encounters/:id/hpi`; display `toast.success` on save
    - On load, GET existing HPI and pre-populate form
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Create StructuredVisitForms component
    - Create `packages/frontend/src/components/encounter/StructuredVisitForms.tsx`
    - Tab/select UI for ANC, PNC, CWC, Family Planning, HIV/TB Screening
    - ANC fields: gravida, para, LMP, EDD (auto-calculated), fundal height, fetal heart rate, presentation, position
    - CWC fields: immunisation checklist, weight-for-age, height-for-age, MUAC
    - FP fields: contraceptive method, next visit date
    - HIV/TB fields: HIV test result, TB symptom screen checkboxes, referral recommendation
    - Highlight required fields and block submission if blank
    - Pre-populate from saved data on re-open
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.3 Create ReviewOfSystems component
    - Create `packages/frontend/src/components/encounter/ReviewOfSystems.tsx`
    - Ten system toggles: General, HEENT, Cardiovascular, Respiratory, GI, GU, Musculoskeletal, Neurological, Skin, Psychiatric
    - When toggled "Abnormal", reveal free-text field for that system
    - Save/restore state via React Query
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.4 Create MedicationHistory component
    - Create `packages/frontend/src/components/encounter/MedicationHistory.tsx`
    - Sections: current medications (add/edit/remove individual entries), allergies (with severity badge), past medical history, surgical history, family history, social history
    - Display prominent red allergy alert banner when any allergy has severity "Severe"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.5 Create PhysicalExamination component
    - Create `packages/frontend/src/components/encounter/PhysicalExamination.tsx`
    - Read-only vitals summary at top (from latest triage record)
    - System toggles for: General Appearance, HEENT, Neck, Chest/Lungs, Heart, Abdomen, Extremities, Neurological, Skin
    - Free-text field revealed on "Abnormal" toggle
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.6 Create ICD10Search shared component
    - Create `packages/frontend/src/components/ICD10Search.tsx`
    - Debounced input (300 ms) that calls GET `/api/icd10/search?q=` on ≥2 characters
    - Dropdown list of matching codes + descriptions
    - Accepts `onSelect(code, description)` callback prop
    - _Requirements: 6.1, 6.2_

  - [x] 5.7 Create DiagnosisAndPlan component
    - Create `packages/frontend/src/components/encounter/DiagnosisAndPlan.tsx`
    - Embed `ICD10Search` for adding Primary and Secondary diagnoses
    - Validate at least one ICD-10 code selected before allowing save
    - Fields: clinical assessment notes, management plan, follow-up instructions, referral type + details
    - Display saved diagnoses in patient overview panel
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.8 Create PrescriptionForm component
    - Create `packages/frontend/src/components/encounter/PrescriptionForm.tsx`
    - Drug search field querying `hms_stock` formulary; show "Out of Stock" warning for zero-quantity items (but still allow prescribing)
    - Add multiple drug items: drug name, dose, frequency, duration, route, patient instructions
    - Print prescription button generating formatted document with facility name, patient, date, prescriber, drug items
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.9 Create EncounterAppointment component
    - Create `packages/frontend/src/components/encounter/EncounterAppointment.tsx`
    - Pre-fill patient name and ID from current encounter context
    - Fields: provider, date, time, appointment type, notes
    - Display conflict warning if slot is already booked
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.10 Create PatientBills component
    - Create `packages/frontend/src/components/encounter/PatientBills.tsx`
    - Bill builder with line items for consultation, procedures, investigations, drugs
    - Running total display in KES
    - Cash and M-Pesa STK Push payment buttons; show payment status (Pending/Completed/Failed)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 5.11 Checkpoint — Verify all encounter components render without errors and integrate with the existing encounter page sidebar
    - Ensure all tests pass, ask the user if questions arise.


- [x] 6. Reports Module
  - [x] 6.1 Implement reports backend controller and route
    - Create `packages/backend/src/controllers/reportController.ts`
    - Implement endpoints:
      - GET `/api/reports/clinical?from=&to=` — patient visits, encounter type breakdown, top-10 diagnoses, provider workload
      - GET `/api/reports/financial?from=&to=` — revenue by service type, by payment method, outstanding invoices, daily/weekly/monthly summaries
      - GET `/api/reports/inventory?from=&to=` — stock levels, below-reorder items, expiring within 30 days, consumption by item
      - GET `/api/reports/patients?from=&to=` — new registrations, demographics breakdown, patient tags frequency
    - All queries use raw SQL via `sequelize.query()`
    - Create `packages/backend/src/routes/reportRoutes.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 6.2 Create shared DateRangePicker component
    - Create `packages/frontend/src/components/DateRangePicker.tsx`
    - Preset buttons: Today, This Week, This Month, Custom Range
    - Custom Range shows start date + end date inputs
    - Accepts `onChange({ from, to })` callback prop
    - _Requirements: 10.2_

  - [x] 6.3 Create shared ExportButtons component
    - Create `packages/frontend/src/components/ExportButtons.tsx`
    - "Export PDF" button: uses `jsPDF` or `window.print()` to generate PDF with facility name, report title, date range, and data table
    - "Export CSV" button: serialises current report data to CSV and triggers download
    - Accepts `data`, `filename`, `title` props
    - _Requirements: 10.7, 10.8_

  - [x] 6.4 Implement ReportsPage frontend
    - Create `packages/frontend/src/pages/ReportsPage.tsx` (replace empty shell)
    - Four category tabs: Clinical, Financial, Inventory, Patient
    - Embed `DateRangePicker` and `ExportButtons` on each tab
    - Fetch data via React Query on tab change or date range change
    - Match gradient-header + card-based Tailwind UI style
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_


- [x] 7. Messaging Module
  - [x] 7.1 Implement messaging backend controller and route
    - Create `packages/backend/src/controllers/messagingController.ts`
    - Implement:
      - POST `/api/messaging/send` — send SMS to one or more patients via `smsService.ts`; log result to `hms_sms_log` table (create this table in migration 004 or a new migration)
      - POST `/api/messaging/bulk` — send to patient group by tag; return estimated recipient count before sending
      - GET `/api/messaging/history` — all sent messages in reverse chronological order
      - GET `/api/messaging/templates` — return the five pre-built templates
    - On AT API error, log failure with `error_reason` and return error response
    - Create `packages/backend/src/routes/messagingRoutes.ts`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 7.2 Write property test for SMS history logging round-trip
    - **Property 10: SMS History Logging Round-Trip**
    - **Validates: Requirements 11.3**
    - For any send operation, the history record must contain exact recipient phone, exact message body, non-null timestamp, and status in {Sent, Delivered, Failed}

  - [x] 7.3 Implement MessagingPage frontend
    - Create `packages/frontend/src/pages/MessagingPage.tsx` (replace empty shell)
    - Four tabs: Compose, Bulk SMS, Templates, History
    - Compose: patient multi-select by name/phone, message body (160-char counter), Send button
    - Bulk SMS: patient group tag selector, message body, estimated recipient count display
    - Templates: list five pre-built templates; clicking one pre-fills Compose message body
    - History: table with recipient name, phone, message preview, status badge, timestamp — reverse chronological
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_


- [x] 8. Expense Management
  - [x] 8.1 Implement expense backend controller and routes
    - Create `packages/backend/src/controllers/expenseController.ts`
    - Implement CRUD for `expenses` table:
      - GET `/api/expenses?from=&to=&category=` — filtered list
      - POST `/api/expenses` — create expense (date, description, category, amount, notes)
      - PUT `/api/expenses/:id` — update expense
      - DELETE `/api/expenses/:id` — delete expense (with confirmation enforced on frontend)
    - Create `packages/backend/src/routes/expenseRoutes.ts`
    - Call `logAudit` on create/update/delete
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 8.2 Implement budget backend controller and route
    - Create budget endpoints in `expenseController.ts` (or a separate `budgetController.ts`):
      - GET `/api/budgets?period=` — get all budgets for a period
      - POST `/api/budgets` — set budget for a category + period (upsert)
    - Create `packages/backend/src/routes/budgetRoutes.ts`
    - _Requirements: 12.7, 12.8, 12.9_

  - [x] 8.3 Enhance ExpenseHistoryPage frontend
    - Enhance `packages/frontend/src/pages/ExpenseHistoryPage.tsx`
    - Table columns: Date, Description, Category, Amount (KES), Actions (Edit/Delete)
    - Add Expense modal form: date, description, category dropdown (Salaries/Utilities/Supplies/Equipment/Maintenance/Other), amount, notes
    - Date range filter and category filter controls
    - Confirmation prompt before delete
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 8.4 Enhance ExpenseSummaryPage frontend
    - Enhance `packages/frontend/src/pages/ExpenseSummaryPage.tsx`
    - Pie chart of expenses by category (use Recharts or Chart.js, matching existing charting library)
    - Monthly trend bar chart
    - Budget vs. actual comparison table per category; highlight rows in red where actual > budget
    - Budget input fields per category that POST to `/api/budgets`
    - _Requirements: 12.7, 12.8, 12.9_


- [x] 9. Pharmacy Module
  - [x] 9.1 Implement pharmacy backend controller and route
    - Create `packages/backend/src/controllers/pharmacyController.ts`
    - Implement:
      - GET `/api/pharmacy/queue` — all prescriptions with status "Pending", ordered by `created_at`
      - GET `/api/pharmacy/prescriptions/:id` — prescription detail with patient, encounter, prescriber, and all items
      - POST `/api/pharmacy/prescriptions/:id/dispense` — mark items as dispensed; decrement `hms_stock.quantity` in a transaction; reject if quantity would go below zero (return 409)
      - GET `/api/pharmacy/history` — all dispensed prescriptions
      - GET `/api/pharmacy/formulary` — list all drug entries in `hms_stock`
      - POST `/api/pharmacy/formulary` — add drug entry
      - PUT `/api/pharmacy/formulary/:id` — edit drug entry
      - PATCH `/api/pharmacy/formulary/:id/deactivate` — deactivate drug entry
    - Create `packages/backend/src/routes/pharmacyRoutes.ts`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ]* 9.2 Write property test for stock non-negative after dispensing
    - **Property 2: Stock Non-Negative After Dispensing**
    - **Validates: Requirements 13.4, 19.5**
    - For any initial stock qty and dispensed qty: if dispensed ≤ initial, result ≥ 0; if dispensed > initial, operation must throw/reject

  - [x] 9.3 Implement PharmacyPage frontend
    - Create `packages/frontend/src/pages/PharmacyPage.tsx`
    - Two tabs: Prescription Queue and Dispensing History
    - Queue: table of pending prescriptions with patient name, encounter date, prescriber; click to open dispensing modal
    - Dispensing modal: show all drug items with dose/frequency/duration/route; "Mark Dispensed" per item; show insufficient stock warning if qty = 0
    - History tab: table with patient name, drug items, dispensed qty, date, pharmacist name
    - Third tab: Drug Formulary management (add/edit/deactivate drugs)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_


- [x] 10. Ward/IPD Module
  - [x] 10.1 Implement ward backend controller and route
    - Create `packages/backend/src/controllers/wardController.ts`
    - Implement:
      - GET `/api/wards` — list all wards with total/occupied/vacant bed counts
      - POST `/api/wards` — create ward (name, type, total bed count); insert into `hms_wards`
      - GET `/api/wards/:id/beds` — list all beds for a ward with status
      - POST `/api/wards/:id/beds` — add a bed to a ward
      - PATCH `/api/wards/:id/beds/:bedId` — update bed status (Vacant/Reserved/Maintenance)
    - Create `packages/backend/src/routes/wardRoutes.ts`
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 10.2 Implement admissions backend controller and route
    - Create `packages/backend/src/controllers/admissionController.ts`
    - Implement:
      - POST `/api/admissions` — create admission; check bed status is "Vacant" before inserting; set bed status to "Occupied"; return 409 if bed is already occupied
      - GET `/api/admissions` — list active admissions
      - GET `/api/admissions/:id` — admission detail
      - POST `/api/admissions/:id/discharge` — update admission with discharge date, diagnosis, summary, medications; set bed status back to "Vacant"
      - POST `/api/admissions/:id/notes` — add ward round note to `hms_ward_notes`
      - GET `/api/admissions/:id/notes` — list ward notes for an admission
    - Create `packages/backend/src/routes/admissionRoutes.ts`
    - _Requirements: 14.4, 14.5, 14.6, 14.7, 14.8_

  - [ ]* 10.3 Write property test for bed exclusivity
    - **Property 3: Bed Exclusivity**
    - **Validates: Requirements 14.4, 19.3**
    - For any bed, there must be at most one active admission at any time; a second admission attempt for an occupied bed must be rejected with a conflict error

  - [x] 10.4 Implement WardManagementPage frontend
    - Create `packages/frontend/src/pages/WardManagementPage.tsx`
    - Ward list cards showing name, type, total/occupied/vacant beds
    - "Create Ward" modal form
    - Click ward to open bed grid view with colour-coded status (Occupied=red, Vacant=green, Reserved=yellow, Maintenance=grey)
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 10.5 Implement AdmissionsPage and AdmissionDetailPage frontend
    - Create `packages/frontend/src/pages/AdmissionsPage.tsx` — list of active admissions with patient name, ward, bed, admission date, admitting diagnosis
    - Create `packages/frontend/src/pages/AdmissionDetailPage.tsx` — admission detail with ward notes timeline, discharge form, discharge summary document generation
    - Discharge summary document includes: patient demographics, admission/discharge dates, diagnoses, procedures, discharge medications
    - _Requirements: 14.5, 14.6, 14.7, 14.8_

  - [x] 10.6 Checkpoint — Verify ward and admission flows end-to-end (create ward → add beds → admit patient → add note → discharge)
    - Ensure all tests pass, ask the user if questions arise.


- [x] 11. Laboratory Module Enhancement
  - [x] 11.1 Implement lab backend controller and route
    - Create `packages/backend/src/controllers/labController.ts`
    - Implement:
      - GET `/api/lab/worklist` — all investigation requests with patient name, test name, requesting clinician, request time, status
      - PATCH `/api/lab/requests/:id/collect` — mark sample collected; record `collection_timestamp`; update status to "Sample Collected"
      - GET `/api/lab/requests/:id/parameters` — get test parameters with reference ranges
      - POST `/api/lab/requests/:id/results` — save result values; validate `request_id` exists in `hms_investigation_requests` (return 422 if not); flag values as High/Low/Critical based on reference range deviation; update status to "Resulted"
      - PATCH `/api/lab/requests/:id/validate` — validate results; record validator ID and timestamp; update status to "Validated"; notify requesting clinician
      - GET `/api/lab/requests/:id/report` — get formatted report data for printing
    - Create `packages/backend/src/routes/labRoutes.ts`
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 11.2 Write property test for investigation result reference validity
    - **Property 6: Investigation Result Reference Validity**
    - **Validates: Requirements 19.6**
    - For any result save with a non-existent `request_id`, the system must reject with HTTP 422 and create no result record

  - [ ]* 11.3 Write property test for investigation result storage round-trip
    - **Property 8: Investigation Result Storage Round-Trip**
    - **Validates: Requirements 15.9**
    - For any valid result record, saving then retrieving by `request_id` must produce a record whose fields deep-equal the saved values

  - [x] 11.4 Implement LabWorklist frontend
    - Create `packages/frontend/src/pages/LabWorklist.tsx`
    - Worklist table: patient name, test name, requesting clinician, request time, status badge, turnaround time
    - Status workflow buttons: "Mark Collected" → "Enter Results" → "Validate"
    - Result entry modal: parameter list with reference ranges, result value inputs, auto-flagging (H/L/Critical) on blur
    - Print report button for validated results (formatted with facility name, patient demographics, parameters, results, reference ranges, flags, validator line)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_


- [x] 12. SHA/NHIF Insurance Module
  - [x] 12.1 Implement insurance backend controller and route
    - Create `packages/backend/src/controllers/insuranceController.ts`
    - Implement:
      - GET `/api/insurance/schemes` — list all insurance schemes
      - POST `/api/insurance/schemes` — create scheme with benefit packages JSONB
      - PUT `/api/insurance/schemes/:id` — update scheme benefit package rates
      - GET `/api/patients/:id/insurance` — get patient insurance details
      - POST `/api/patients/:id/insurance` — save SHA number, NHIF number, scheme ID
    - Create `packages/backend/src/routes/insuranceRoutes.ts`
    - _Requirements: 16.1, 16.7_

  - [x] 12.2 Implement claims backend controller and route
    - Create `packages/backend/src/controllers/claimController.ts`
    - Implement:
      - GET `/api/claims` — list all claims with patient name, encounter date, scheme, claimed amount, status
      - POST `/api/claims` — generate claim from encounter; auto-populate items from services/investigations/drugs; cap `claimed_amount` at scheme benefit limit (return warning if capped)
      - GET `/api/claims/:id` — claim detail with all items
      - PATCH `/api/claims/:id/status` — update claim status (Submitted/Approved/Rejected/Paid); on "Paid", record payment amount and date, update linked invoice balance
      - POST `/api/encounters/:id/pre-auth` — record pre-auth number, procedure, authorised amount, validity date
    - Create `packages/backend/src/routes/claimRoutes.ts`
    - _Requirements: 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ]* 12.3 Write property test for claim amount cap
    - **Property 4: Claim Amount Cap**
    - **Validates: Requirements 16.5, 19.4**
    - For any requested amount and benefit limit, `effective_claimed = min(requested, limit)`; effective amount must be ≤ limit and ≤ requested

  - [x] 12.4 Implement InsurancePage frontend
    - Create `packages/frontend/src/pages/InsurancePage.tsx`
    - Two tabs: Claims Management and Insurance Schemes
    - Claims tab: table with patient name, encounter date, scheme, claimed amount (KES), status badge; "Generate Claim" button; status update dropdown
    - Schemes tab: list of configured schemes with benefit package rates; add/edit scheme form
    - Pre-authorization form accessible from encounter context
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_


- [x] 13. Admin Panel
  - [x] 13.1 Implement admin backend controller and route
    - Create `packages/backend/src/controllers/adminController.ts`
    - Implement:
      - GET `/api/admin/users` — list all users with name, email, role, linked staff record, active status
      - POST `/api/admin/users` — create user; hash password with bcrypt; send welcome SMS via `smsService.ts`
      - PUT `/api/admin/users/:id` — edit user (name, email, role)
      - PATCH `/api/admin/users/:id/deactivate` — deactivate user account
      - GET `/api/admin/roles` — list roles with their permissions
      - PUT `/api/admin/roles/:id/permissions` — assign permissions to a role (using `hms_user_roles`, `hms_permissions`, `hms_role_permissions`)
      - GET `/api/admin/audit-log?from=&to=&userId=&resource=` — audit log with filters, reverse chronological
      - GET `/api/admin/settings` — get system settings (facility name, KRA PIN, SMS sender ID, M-Pesa shortcode)
      - PUT `/api/admin/settings` — update system settings
    - Create `packages/backend/src/routes/adminRoutes.ts`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 20.4, 20.5, 20.6_

  - [x] 13.2 Implement AdminPanelPage frontend
    - Create `packages/frontend/src/pages/AdminPanelPage.tsx` (replace empty shell)
    - Four tabs: User Management, Roles & Permissions, Audit Log, System Settings
    - User Management: table with create/edit/deactivate actions; create user modal with name, email, role, phone
    - Roles & Permissions: role list with permission checkboxes (create/edit/view/archive per resource)
    - Audit Log: table with date, user, action, resource, resource ID; date range + user + resource filters
    - System Settings: form for facility name, KRA PIN, default currency, SMS sender ID, M-Pesa shortcode
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_


- [ ] 14. Enhanced Dashboard
  - [x] 14.1 Implement dashboard backend controller and route
    - Create `packages/backend/src/controllers/dashboardController.ts`
    - Implement:
      - GET `/api/dashboard/stats` — today's patient count, today's revenue (KES), pending investigation count, current bed occupancy percentage
      - GET `/api/dashboard/alerts` — stock items below reorder level, drugs expiring within 30 days, pending lab results older than 2 hours, overdue appointments
      - GET `/api/dashboard/activity` — 20 most recent system actions in reverse chronological order
    - Create `packages/backend/src/routes/dashboardRoutes.ts`
    - _Requirements: 18.1, 18.3, 18.5_

  - [x] 14.2 Create AlertsPanel shared component
    - Create `packages/frontend/src/components/AlertsPanel.tsx`
    - Fetches from GET `/api/dashboard/alerts` via React Query with auto-refresh interval
    - Each alert item is clickable and navigates to the relevant module page
    - Categories: low stock, expiring drugs, overdue lab results, overdue appointments
    - _Requirements: 18.3, 18.4_

  - [x] 14.3 Create ActivityFeed shared component
    - Create `packages/frontend/src/components/ActivityFeed.tsx`
    - Fetches from GET `/api/dashboard/activity` via React Query
    - Displays 20 most recent actions in reverse chronological order with icon, description, timestamp
    - _Requirements: 18.5_

  - [x] 14.4 Enhance the Dashboard frontend page
    - Update the existing dashboard page to include:
      - Four stat cards: today's patients, today's revenue (KES), pending investigations, bed occupancy %
      - Quick-action buttons: New Patient Registration, New Encounter, Book Appointment
      - Embed `AlertsPanel` component
      - Embed `ActivityFeed` component
      - Use React Query `refetchInterval` to update stats without full page reload when encounters or payments change
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_


- [x] 15. Router & Navigation Updates
  - [x] 15.1 Register all new backend routes in server.ts
    - Update `packages/backend/src/server.ts` to import and mount:
      - `icd10Routes` at `/api/icd10`
      - `encounterClinicalRoutes` at `/api`
      - `pharmacyRoutes` at `/api/pharmacy`
      - `wardRoutes` at `/api/wards`
      - `admissionRoutes` at `/api/admissions`
      - `labRoutes` at `/api/lab`
      - `insuranceRoutes` at `/api/insurance`
      - `claimRoutes` at `/api/claims`
      - `reportRoutes` at `/api/reports`
      - `messagingRoutes` at `/api/messaging`
      - `expenseRoutes` at `/api/expenses`
      - `budgetRoutes` at `/api/budgets`
      - `adminRoutes` at `/api/admin`
      - `dashboardRoutes` at `/api/dashboard`
    - _Requirements: all modules_

  - [x] 15.2 Update frontend App.tsx with all new routes
    - Update `packages/frontend/src/App.tsx` to add React Router routes for:
      - `/reports` → `ReportsPage`
      - `/messaging` → `MessagingPage`
      - `/expenses` → `ExpenseHistoryPage`
      - `/expenses/summary` → `ExpenseSummaryPage`
      - `/pharmacy` → `PharmacyPage`
      - `/wards` → `WardManagementPage`
      - `/admissions` → `AdmissionsPage`
      - `/admissions/:id` → `AdmissionDetailPage`
      - `/insurance` → `InsurancePage`
      - `/admin` → `AdminPanelPage`
      - `/lab` → `LabWorklist`
    - Ensure all routes are wrapped in the existing `RequireAuth` component
    - _Requirements: all modules_

  - [x] 15.3 Update Sidebar navigation
    - Update the existing Sidebar component to add navigation links for all new pages
    - Group links by module section matching the existing sidebar style
    - _Requirements: all modules_

  - [x] 15.4 Checkpoint — Verify all routes resolve correctly and navigation links work
    - Ensure all tests pass, ask the user if questions arise.


- [x] 16. Property-Based Tests
  - [x] 16.1 Set up fast-check and test runner
    - Install `fast-check` as a dev dependency in `packages/backend`: `npm install --save-dev fast-check`
    - Create `packages/backend/src/tests/correctness.test.ts`
    - Configure the test runner (Jest or Vitest, matching existing backend test setup) to pick up `src/tests/*.test.ts`
    - _Requirements: 19.1–19.7_

  - [ ]* 16.2 Write property test for bill total invariant (Property 1)
    - **Property 1: Bill Total Invariant**
    - **Validates: Requirements 9.4, 19.2**
    - `fc.array(fc.record({ amount: fc.float({ min: 0, max: 100000, noNaN: true }) }), { minLength: 1 })` → `Math.abs(bill.total - sum) < 0.01`

  - [ ]* 16.3 Write property test for stock non-negative after dispensing (Property 2)
    - **Property 2: Stock Non-Negative After Dispensing**
    - **Validates: Requirements 13.4, 19.5**
    - `fc.integer({ min: 0, max: 10000 })` × 2 → if dispensed ≤ initial: result ≥ 0; else: operation throws

  - [ ]* 16.4 Write property test for bed exclusivity (Property 3)
    - **Property 3: Bed Exclusivity**
    - **Validates: Requirements 14.4, 19.3**
    - Simulate two concurrent admission attempts for the same bed; second must be rejected

  - [ ]* 16.5 Write property test for claim amount cap (Property 4)
    - **Property 4: Claim Amount Cap**
    - **Validates: Requirements 16.5, 19.4**
    - `fc.float({ min: 0, max: 1000000 })` × 2 → `effective = min(requested, limit)`; effective ≤ limit AND effective ≤ requested

  - [ ]* 16.6 Write property test for prescription reference validity (Property 5)
    - **Property 5: Prescription Reference Validity**
    - **Validates: Requirements 19.1**
    - For invalid encounter_id or patient_id, system rejects with HTTP 422 and creates no record

  - [ ]* 16.7 Write property test for investigation result reference validity (Property 6)
    - **Property 6: Investigation Result Reference Validity**
    - **Validates: Requirements 19.6**
    - For non-existent request_id, system rejects with HTTP 422 and creates no result record

  - [ ]* 16.8 Write property test for structured visit form JSON round-trip (Property 7)
    - **Property 7: Structured Visit Form JSON Round-Trip**
    - **Validates: Requirements 19.7, 2.5, 2.7**
    - `fc.object({ maxDepth: 3 })` → `JSON.parse(JSON.stringify(formData))` deep-equals original

  - [ ]* 16.9 Write property test for investigation result storage round-trip (Property 8)
    - **Property 8: Investigation Result Storage Round-Trip**
    - **Validates: Requirements 15.9**
    - Save result record then retrieve by request_id; all fields must deep-equal saved values

  - [ ]* 16.10 Write property test for ICD-10 search filter correctness (Property 9)
    - **Property 9: ICD-10 Search Filter Correctness**
    - **Validates: Requirements 6.1**
    - `fc.string({ minLength: 2, maxLength: 20 })` → every result contains query in `code` or `description` (case-insensitive)

  - [ ]* 16.11 Write property test for SMS history logging round-trip (Property 10)
    - **Property 10: SMS History Logging Round-Trip**
    - **Validates: Requirements 11.3**
    - For any send operation, history record contains exact phone, exact body, non-null timestamp, status in {Sent, Delivered, Failed}

  - [x] 16.12 Final checkpoint — Run all property-based tests and ensure all pass
    - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- All backend controllers use `sequelize.query()` with raw SQL — no Sequelize models
- All new DB tables use the `hms_` prefix
- All frontend pages match the existing gradient-header + card-based Tailwind UI style
- JWT auth (`hms_token`) is applied to all new routes via the existing `auth` middleware
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Checkpoints ensure incremental validation at the end of each major phase
