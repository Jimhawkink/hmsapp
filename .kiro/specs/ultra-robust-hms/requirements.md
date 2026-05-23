# Requirements Document

## Introduction

This feature completes and extends the Kenya-based Hospital Management System (HMS) deployed at `hospital-mu-azure.vercel.app`. The system is a React 18 + Vite + TypeScript frontend with an Express + Sequelize + PostgreSQL (Supabase) backend. The goal is to implement all missing functionality across ten modules — Clinical Encounter Workflow, Reports, Messaging, Expense Management, Pharmacy, Ward/IPD, Laboratory, SHA/NHIF Insurance, Admin Panel, and Enhanced Dashboard — to produce a production-ready HMS that surpasses Ilara HMS for Kenya-based facilities.

All monetary values are in Kenya Shillings (KES). The system integrates with M-Pesa (STK Push), Africa's Talking SMS/WhatsApp, and Kenya's Social Health Authority (SHA) / NHIF insurance schemes. All new database tables use the `hms_` prefix. All new frontend pages match the existing Tailwind + gradient-header + card-based UI style.

---

## Glossary

- **HMS**: Hospital Management System — the software system described in this document.
- **Encounter**: A single clinical visit record linking a patient to a provider, stored in `hms_encounters`.
- **Triage**: The initial assessment of a patient's vital signs, stored in `hms_triages`.
- **Complaint**: A patient's chief complaint recorded during an encounter, stored in `hms_complaints`.
- **HPI**: History of Present Illness — a structured narrative of the complaint.
- **ROS**: Review of Systems — a systematic checklist of body systems.
- **ICD-10**: International Classification of Diseases, 10th Revision — the standard diagnosis coding system.
- **Prescription**: A clinician's order for medication, linked to an encounter.
- **Formulary**: The approved list of drugs available for prescribing.
- **Dispensing**: The act of preparing and handing medication to a patient from the pharmacy.
- **Ward**: A named inpatient unit (e.g., Medical, Surgical, Maternity, Pediatric, ICU).
- **Bed**: A physical bed within a ward, with an occupancy status.
- **Admission**: The formal process of assigning a patient to a bed in a ward.
- **Discharge**: The formal process of releasing an admitted patient from a ward.
- **SHA**: Social Health Authority — Kenya's national health insurance body (successor to NHIF).
- **NHIF**: National Hospital Insurance Fund — Kenya's legacy health insurance scheme.
- **Claim**: A formal request submitted to SHA/NHIF for reimbursement of services rendered.
- **Pre-authorization**: Approval obtained from SHA/NHIF before performing a covered procedure.
- **ANC**: Antenatal Care — structured visits for pregnant patients.
- **PNC**: Postnatal Care — structured visits for patients after delivery.
- **CWC**: Child Welfare Clinic — structured visits for children under five.
- **MUAC**: Mid-Upper Arm Circumference — a nutritional assessment measurement.
- **LMP**: Last Menstrual Period — used to calculate gestational age.
- **EDD**: Estimated Date of Delivery.
- **STK Push**: Safaricom M-Pesa SIM Toolkit Push — initiates a mobile payment prompt on a customer's phone.
- **Africa's_Talking**: Third-party SMS/WhatsApp API provider used for patient notifications.
- **KES**: Kenya Shillings — the currency used for all monetary values in the system.
- **KRA_PIN**: Kenya Revenue Authority Personal Identification Number — printed on receipts.
- **Audit_Log**: A tamper-evident record of every create, update, and delete action in the system.
- **Role**: A named set of permissions assigned to a staff member (e.g., Doctor, Nurse, Cashier).
- **Permission**: A granular access right controlling create/edit/view/archive on a resource.
- **Stock**: Physical inventory of drugs and supplies, stored in `hms_stock`.
- **Investigation**: A lab test or imaging study requested for a patient.
- **Sample**: A biological specimen collected for laboratory analysis.
- **Reference_Range**: The normal value range for a laboratory parameter.
- **Turnaround_Time**: The elapsed time from investigation request to result release.
- **Expense**: A recorded operational cost, stored in the `expenses` table.
- **Budget**: A planned spending limit per expense category per period.
- **SMS_Template**: A pre-written message body used for common patient notifications.
- **Bulk_SMS**: A single send operation targeting multiple patients simultaneously.
- **Report**: A generated summary of clinical, financial, inventory, or patient data.
- **Export**: The action of downloading a report as PDF or CSV.

---

## Requirements

### Requirement 1: Complaints & History of Present Illness (HPI)

**User Story:** As a clinician, I want to record a patient's chief complaints and HPI during an encounter, so that I have a structured record of the presenting problem.

#### Acceptance Criteria

1. WHEN a clinician opens the "Complaints & HPI" section for an active encounter, THE HMS SHALL display a form with fields for complaint text, duration value (integer), duration unit (hours/days/weeks/months), onset, character, radiation, associated symptoms, timing, exacerbating factors, relieving factors, and an HPI narrative text area.
2. WHEN a clinician submits the complaints form with a valid encounter ID and at least one complaint text, THE HMS SHALL save the record to `hms_complaints` and display a success notification.
3. IF the encounter ID does not exist in `hms_encounters`, THEN THE HMS SHALL return HTTP 404 and display an error message to the clinician.
4. WHEN a clinician views the "Complaints & HPI" section for an encounter that already has saved complaints, THE HMS SHALL display all previously saved complaints in chronological order.
5. THE HMS SHALL allow a clinician to add multiple complaint entries per encounter.
6. WHEN a complaint is saved, THE HMS SHALL associate it with both the encounter ID and the patient ID for cross-referencing.

---

### Requirement 2: Structured Visit Forms

**User Story:** As a clinician, I want to fill structured visit forms (ANC, PNC, CWC, Family Planning, HIV/TB screening) during an encounter, so that Kenya-specific clinical data is captured in a standardised format.

#### Acceptance Criteria

1. WHEN a clinician selects "Antenatal Care (ANC)" from the structured visit forms menu, THE HMS SHALL display a form with fields for gravida, para, LMP, EDD (auto-calculated from LMP), fundal height (cm), fetal heart rate (bpm), presentation, and position.
2. WHEN a clinician selects "Child Welfare Clinic (CWC)", THE HMS SHALL display a form with fields for immunisation status (checklist), growth monitoring (weight-for-age, height-for-age), and MUAC (cm).
3. WHEN a clinician selects "Family Planning", THE HMS SHALL display a form with fields for contraceptive method and next visit date.
4. WHEN a clinician selects "HIV/TB Screening", THE HMS SHALL display a form with fields for HIV test result, TB symptom screen (cough, fever, night sweats, weight loss), and referral recommendation.
5. WHEN a clinician submits a structured visit form with a valid encounter ID, THE HMS SHALL save the form data as a JSON object to the encounter record and display a success notification.
6. IF a required field in a structured visit form is left blank, THEN THE HMS SHALL highlight the field and prevent submission until it is completed.
7. WHEN a structured visit form has been previously saved for an encounter, THE HMS SHALL pre-populate the form with the saved values on re-opening.

---

### Requirement 3: Review of Systems (ROS)

**User Story:** As a clinician, I want to perform a systematic review of body systems during an encounter, so that I do not miss clinically relevant findings.

#### Acceptance Criteria

1. THE HMS SHALL present a ROS form covering ten systems: General, HEENT, Cardiovascular, Respiratory, Gastrointestinal, Genitourinary, Musculoskeletal, Neurological, Skin, and Psychiatric.
2. WHEN a clinician marks a system as "Abnormal", THE HMS SHALL reveal a free-text field for that system to record positive findings.
3. WHEN a clinician submits the ROS form for an active encounter, THE HMS SHALL save the ROS data to the encounter record and display a success notification.
4. WHEN a clinician re-opens the ROS section for an encounter with saved data, THE HMS SHALL restore all previously entered values.

---

### Requirement 4: Medication History

**User Story:** As a clinician, I want to record a patient's medication history, allergies, past medical history, surgical history, family history, and social history, so that this information is available across all future encounters.

#### Acceptance Criteria

1. THE HMS SHALL provide a medication history form with sections for: current medications (drug name, dose, frequency, duration, indication), drug/food/environmental allergies (allergen, reaction type, severity), past medical history (free text), surgical history (free text), family history (free text), and social history (smoking status, alcohol use, occupation).
2. WHEN a clinician saves medication history for a patient, THE HMS SHALL persist the data to the patient record so it is available in all future encounters for that patient.
3. WHEN a clinician opens the medication history section for a patient with existing records, THE HMS SHALL display the most recently saved medication history.
4. WHEN a clinician records an allergy with severity "Severe", THE HMS SHALL display a prominent allergy alert banner in the patient overview panel.
5. THE HMS SHALL allow a clinician to add, edit, and remove individual medication entries without replacing the entire medication history record.

---

### Requirement 5: Physical Examination

**User Story:** As a clinician, I want to record a system-by-system physical examination during an encounter, so that examination findings are documented alongside vitals and complaints.

#### Acceptance Criteria

1. THE HMS SHALL display a physical examination form with sections for: General Appearance, HEENT, Neck, Chest/Lungs, Heart, Abdomen, Extremities, Neurological, and Skin.
2. WHEN a clinician opens the examination section, THE HMS SHALL display the latest triage vitals for the patient at the top of the form as a read-only summary.
3. WHEN a clinician toggles a system to "Abnormal", THE HMS SHALL reveal a free-text field for that system's findings.
4. WHEN a clinician submits the examination form for an active encounter, THE HMS SHALL save the findings to the encounter record and display a success notification.
5. WHEN a clinician re-opens the examination section for an encounter with saved data, THE HMS SHALL restore all previously entered values.

---

### Requirement 6: Diagnosis and Plan

**User Story:** As a clinician, I want to record ICD-10 diagnoses and a management plan during an encounter, so that the clinical decision is formally documented.

#### Acceptance Criteria

1. THE HMS SHALL provide a searchable ICD-10 code lookup with a pre-loaded set of at least 200 common Kenya diagnoses (malaria, typhoid, pneumonia, HIV, TB, hypertension, diabetes, anaemia, etc.).
2. WHEN a clinician types at least two characters in the diagnosis search field, THE HMS SHALL display matching ICD-10 codes and descriptions within 300 ms.
3. THE HMS SHALL allow a clinician to designate one diagnosis as "Primary" and add one or more "Secondary" diagnoses per encounter.
4. WHEN a clinician saves the diagnosis and plan, THE HMS SHALL persist the ICD-10 codes, clinical assessment notes, management plan, follow-up instructions, and referral details (internal/external) to the encounter record.
5. IF a clinician attempts to save a diagnosis without selecting at least one ICD-10 code, THEN THE HMS SHALL display a validation error and prevent saving.
6. WHEN a diagnosis is saved, THE HMS SHALL display the saved diagnoses in the patient overview panel for the current encounter.

---

### Requirement 7: Prescription

**User Story:** As a clinician, I want to write prescriptions linked to an encounter, so that the pharmacy can dispense the correct medications.

#### Acceptance Criteria

1. THE HMS SHALL provide a drug search field that queries the stock formulary (`hms_stock`) and returns matching drug names, dosage forms, and available quantities.
2. WHEN a clinician adds a drug to the prescription, THE HMS SHALL capture: drug name, dose, frequency, duration, route of administration, and patient instructions.
3. THE HMS SHALL allow a clinician to add multiple drug items to a single prescription.
4. WHEN a clinician saves the prescription, THE HMS SHALL persist all prescription items linked to the encounter ID and patient ID, and display a success notification.
5. WHEN a prescription is saved, THE HMS SHALL make it visible in the pharmacy dispensing queue.
6. THE HMS SHALL allow a clinician to print the prescription as a formatted document including facility name, patient name, date, prescriber name, and all drug items.
7. IF a drug's available stock quantity is zero, THEN THE HMS SHALL display a "Out of Stock" warning on the drug search result but still allow the clinician to prescribe it.

---

### Requirement 8: Appointment Booking from Encounter

**User Story:** As a clinician, I want to book a follow-up appointment directly from within an encounter, so that the patient's next visit is scheduled before they leave.

#### Acceptance Criteria

1. WHEN a clinician opens the "Appointment Schedule" section within an encounter, THE HMS SHALL display a booking form pre-filled with the current patient's name and ID.
2. THE HMS SHALL allow the clinician to select a provider, appointment date, appointment time, appointment type, and add notes.
3. WHEN a clinician submits the appointment booking form with all required fields, THE HMS SHALL create the appointment in `hms_appointments` and display a confirmation with the appointment reference number.
4. IF the selected time slot is already booked for the selected provider, THEN THE HMS SHALL display a conflict warning and prevent double-booking.

---

### Requirement 9: Patient Bills from Encounter

**User Story:** As a clinician or cashier, I want to generate a bill from within an encounter, so that all services, investigations, and drugs are charged to the patient in one place.

#### Acceptance Criteria

1. WHEN a user opens the "Patient Bills" section within an encounter, THE HMS SHALL display a bill builder with the current patient and encounter pre-selected.
2. THE HMS SHALL allow the user to add line items for: consultation fees, procedure charges, investigation charges (linked to requested investigations), and drug charges (linked to prescriptions).
3. WHEN line items are added, THE HMS SHALL calculate and display the running total in KES.
4. THE Bill_Total SHALL equal the sum of all individual line item amounts at all times.
5. WHEN a user submits the bill, THE HMS SHALL create an invoice in `hms_invoices` linked to the encounter and patient, and display a success notification.
6. THE HMS SHALL allow the user to process payment via Cash or M-Pesa STK Push directly from the bill view.
7. WHEN an M-Pesa STK Push payment is initiated, THE HMS SHALL display the payment status (Pending/Completed/Failed) and update the invoice status accordingly.

---

### Requirement 10: Reports Module

**User Story:** As a hospital administrator, I want to generate clinical, financial, inventory, and patient reports with date range filters and export options, so that I can monitor facility performance.

#### Acceptance Criteria

1. THE HMS SHALL provide a Reports page with four report categories: Clinical, Financial, Inventory, and Patient.
2. THE HMS SHALL provide date range filter options: Today, This Week, This Month, and Custom Range (start date + end date picker).
3. WHEN a user selects "Clinical Reports", THE HMS SHALL display: patient visits by date range, encounter type breakdown, top 10 diagnoses by frequency, and provider workload (encounters per provider).
4. WHEN a user selects "Financial Reports", THE HMS SHALL display: total revenue by service type, revenue by payment method (Cash/M-Pesa/SHA), outstanding invoice total, and daily/weekly/monthly revenue summaries.
5. WHEN a user selects "Inventory Reports", THE HMS SHALL display: current stock levels for all items, items with quantity below reorder level, items expiring within 30 days, and stock consumption by item over the selected period.
6. WHEN a user selects "Patient Reports", THE HMS SHALL display: new patient registrations by date range, patient demographics breakdown (gender, age group, county), and patient tags frequency report.
7. WHEN a user clicks "Export PDF" on any report, THE HMS SHALL generate and download a PDF of the current report view including the facility name, report title, date range, and data table.
8. WHEN a user clicks "Export CSV" on any report, THE HMS SHALL generate and download a CSV file of the report data.

---

### Requirement 11: Messaging Module

**User Story:** As a hospital administrator or receptionist, I want to send SMS and WhatsApp messages to patients, so that I can send appointment reminders, lab result notifications, and payment receipts.

#### Acceptance Criteria

1. THE HMS SHALL provide a Messaging page with tabs for: Compose, Bulk SMS, Templates, and History.
2. WHEN a user composes an SMS, THE HMS SHALL allow selection of one or more patients by name or phone number, entry of a message body (max 160 characters per SMS segment), and a Send button.
3. WHEN a user sends an SMS via Africa's_Talking API, THE HMS SHALL log the message in the SMS history with status (Sent/Delivered/Failed), recipient phone number, message body, and timestamp.
4. WHEN a user selects "Bulk SMS", THE HMS SHALL allow selection of a patient group by tag, entry of a message body, and display the estimated recipient count before sending.
5. THE HMS SHALL provide at least five pre-built SMS templates: Appointment Reminder, Lab Results Ready, Payment Receipt, Follow-up Reminder, and General Notification.
6. WHEN a user selects a template, THE HMS SHALL pre-fill the message body with the template text and allow editing before sending.
7. IF the Africa's_Talking API returns an error for a message, THEN THE HMS SHALL log the failure with the error reason and display an error notification to the user.
8. WHEN a user views the SMS History tab, THE HMS SHALL display all sent messages in reverse chronological order with recipient name, phone, message preview, status, and timestamp.

---

### Requirement 12: Expense Management

**User Story:** As a hospital administrator, I want to record, categorise, and analyse operational expenses, so that I can track spending against budget and identify cost trends.

#### Acceptance Criteria

1. THE HMS SHALL provide an Expense History page with a table showing all recorded expenses with columns: Date, Description, Category, Amount (KES), and Actions (Edit/Delete).
2. WHEN a user adds a new expense, THE HMS SHALL capture: date, description, category (Salaries/Utilities/Supplies/Equipment/Maintenance/Other), amount in KES, and optional notes.
3. WHEN a user saves a new expense, THE HMS SHALL persist it to the `expenses` table and display a success notification.
4. WHEN a user edits an existing expense, THE HMS SHALL update the record and display a success notification.
5. WHEN a user deletes an expense, THE HMS SHALL remove the record after a confirmation prompt and display a success notification.
6. THE HMS SHALL allow filtering of the expense history by date range and by category.
7. THE HMS SHALL provide an Expense Summary page with: a pie chart of expenses by category, a monthly trend bar chart, and a budget vs. actual comparison table per category.
8. WHEN a user sets a budget for a category, THE HMS SHALL persist the budget value and display the variance (actual minus budget) in the summary table.
9. IF actual spending in a category exceeds the budget, THEN THE HMS SHALL highlight that category row in red on the summary page.

---

### Requirement 13: Pharmacy Module

**User Story:** As a pharmacist, I want to view pending prescriptions, dispense drugs to patients, and have stock automatically updated, so that medication dispensing is tracked accurately.

#### Acceptance Criteria

1. THE HMS SHALL provide a Pharmacy page with a Prescription Queue showing all prescriptions with status "Pending" from `hms_prescriptions`, ordered by creation time.
2. WHEN a pharmacist opens a prescription from the queue, THE HMS SHALL display the patient name, encounter date, prescriber name, and all drug items with dose, frequency, duration, and route.
3. WHEN a pharmacist marks a prescription item as "Dispensed", THE HMS SHALL deduct the dispensed quantity from the corresponding stock item in `hms_stock`.
4. THE Stock_Quantity in `hms_stock` SHALL never go below zero as a result of a dispensing action; IF the requested quantity exceeds available stock, THEN THE HMS SHALL display an insufficient stock warning and prevent dispensing.
5. WHEN a pharmacist completes dispensing all items in a prescription, THE HMS SHALL update the prescription status to "Dispensed" and record the dispensing timestamp and pharmacist ID.
6. THE HMS SHALL provide a Dispensing History tab showing all dispensed prescriptions with patient name, drug items, dispensed quantity, dispensing date, and pharmacist name.
7. THE HMS SHALL provide a Drug Formulary management page where an administrator can add, edit, and deactivate drug entries with generic name, brand name, dosage form, and unit of measure.

---

### Requirement 14: Ward and Inpatient (IPD) Module

**User Story:** As a nurse or ward administrator, I want to manage wards, beds, patient admissions, and ward round notes, so that inpatient care is tracked from admission to discharge.

#### Acceptance Criteria

1. THE HMS SHALL provide a Ward Management page listing all wards with name, type (Medical/Surgical/Maternity/Pediatric/ICU), total beds, occupied beds, and vacant beds.
2. WHEN an administrator creates a ward, THE HMS SHALL save it to `hms_wards` with name, type, and total bed count.
3. THE HMS SHALL provide a Bed Management view per ward showing each bed with status: Occupied, Vacant, Reserved, or Maintenance.
4. A Bed SHALL NOT be assigned to more than one patient simultaneously; IF an admission is attempted for an occupied bed, THEN THE HMS SHALL display a conflict error and prevent the admission.
5. WHEN a clinician admits a patient from an encounter, THE HMS SHALL create an admission record in `hms_admissions` with patient ID, encounter ID, ward ID, bed ID, admitting clinician ID, admission date, and admitting diagnosis.
6. WHEN a clinician discharges a patient, THE HMS SHALL update the admission record with discharge date and discharge summary, and set the bed status back to Vacant.
7. THE HMS SHALL allow nurses to record ward round notes per admitted patient with date, time, clinician name, and free-text observations, saved to `hms_ward_notes`.
8. WHEN a patient is discharged, THE HMS SHALL generate a discharge summary document including patient demographics, admission date, discharge date, admitting diagnosis, discharge diagnosis, procedures performed, and discharge medications.

---

### Requirement 15: Laboratory Module Enhancement

**User Story:** As a laboratory technician, I want to manage the full lab workflow from sample collection through result entry, validation, and printing, so that lab results are accurate and traceable.

#### Acceptance Criteria

1. THE HMS SHALL display a Laboratory Worklist showing all pending investigation requests with patient name, test name, requesting clinician, request time, and current status (Requested/Sample Collected/In Progress/Resulted/Validated).
2. WHEN a lab technician marks a sample as "Collected", THE HMS SHALL record the collection timestamp and update the request status to "Sample Collected".
3. WHEN a lab technician enters results for a test with defined parameters, THE HMS SHALL display each parameter with its reference range and allow entry of the result value.
4. WHEN a result value falls outside the reference range, THE HMS SHALL flag it as "High (H)", "Low (L)", or "Critical" based on the deviation.
5. WHEN a lab technician submits results, THE HMS SHALL update the investigation request status to "Resulted" and notify the requesting clinician.
6. WHEN a senior lab technician validates results, THE HMS SHALL update the status to "Validated" and record the validator's ID and timestamp.
7. THE HMS SHALL allow printing of a lab report for a validated result, formatted with facility name, patient demographics, test name, parameters, results, reference ranges, flags, and validator signature line.
8. THE HMS SHALL calculate and display the Turnaround_Time (time from request to validation) for each completed investigation.
9. FOR ALL valid investigation requests, parsing the request then saving results then retrieving results SHALL produce an equivalent result record (round-trip property).

---

### Requirement 16: SHA/NHIF Insurance Module

**User Story:** As a billing officer, I want to record patient insurance details, manage pre-authorisations, generate SHA/NHIF claims, and track claim status, so that the facility can recover insurance revenue.

#### Acceptance Criteria

1. THE HMS SHALL allow recording of a patient's SHA number, NHIF number, and insurance scheme on the patient record.
2. THE HMS SHALL provide a Pre-authorization form where a billing officer can record a pre-auth number, procedure name, authorised amount (KES), and validity date for a patient encounter.
3. THE HMS SHALL provide a Claims Management page listing all generated claims with patient name, encounter date, scheme name, claimed amount (KES), and status (Draft/Submitted/Approved/Rejected/Paid).
4. WHEN a billing officer generates a claim from an encounter, THE HMS SHALL create a claim record in `hms_claims` with all billable services, investigation charges, and drug charges linked to that encounter.
5. THE Claim_Amount SHALL NOT exceed the configured benefit limit for the patient's insurance scheme; IF it does, THE HMS SHALL display a warning and cap the claimable amount at the scheme limit.
6. WHEN a claim status is updated to "Paid", THE HMS SHALL record the payment amount and date and update the outstanding balance on the linked invoice.
7. THE HMS SHALL allow configuration of SHA benefit package rates per service category in `hms_insurance_schemes`.

---

### Requirement 17: Admin Panel

**User Story:** As a system administrator, I want to manage users, roles, permissions, and view audit logs, so that access control and accountability are maintained across the system.

#### Acceptance Criteria

1. THE HMS SHALL provide a User Management page where an administrator can create, edit, and deactivate user accounts with name, email, role, and linked staff record.
2. WHEN an administrator creates a user, THE HMS SHALL hash the password before storing it and send a welcome SMS to the user's registered phone number.
3. THE HMS SHALL provide a Role & Permissions page where an administrator can assign permissions (create/edit/view/archive) per resource to each role using the existing `hms_user_roles`, `hms_permissions`, and `hms_role_permissions` tables.
4. THE HMS SHALL record an Audit_Log entry for every create, update, and delete action in the system, capturing: action type, resource name, resource ID, user ID, user name, and timestamp.
5. WHEN an administrator views the Audit Log, THE HMS SHALL display entries in reverse chronological order with filters for date range, user, and resource type.
6. THE HMS SHALL provide a System Settings page where an administrator can configure: facility name, KRA PIN, default currency (KES), SMS sender ID, and M-Pesa shortcode.
7. WHERE multi-branch support is enabled, THE HMS SHALL allow an administrator to create and manage branch records with name, address, and county.

---

### Requirement 18: Enhanced Dashboard

**User Story:** As any logged-in user, I want to see real-time operational statistics, alerts, and quick actions on the dashboard, so that I can immediately understand the facility's current state.

#### Acceptance Criteria

1. THE HMS SHALL display real-time statistics on the dashboard: today's patient count, today's revenue (KES), pending investigation count, and current bed occupancy percentage.
2. THE HMS SHALL provide quick-action buttons on the dashboard for: New Patient Registration, New Encounter, and Book Appointment.
3. THE HMS SHALL display an Alerts panel showing: stock items below reorder level, drugs expiring within 30 days, pending lab results older than 2 hours, and overdue appointments (scheduled but not checked in).
4. WHEN a user clicks an alert item, THE HMS SHALL navigate to the relevant module page for that alert.
5. THE HMS SHALL display an Activity Feed showing the 20 most recent system actions (patient registered, encounter created, payment received, etc.) in reverse chronological order.
6. WHEN a new encounter is created or a payment is received, THE HMS SHALL update the dashboard statistics without requiring a full page reload.

---

### Requirement 19: Data Integrity and Correctness Properties

**User Story:** As a system architect, I want core business rules enforced at the data layer, so that the system never enters an inconsistent state regardless of concurrent usage.

#### Acceptance Criteria

1. FOR ALL prescriptions, THE HMS SHALL verify that the referenced encounter ID exists in `hms_encounters` and the referenced patient ID exists in `hms_patients` before saving; IF either reference is invalid, THEN THE HMS SHALL return HTTP 422 and reject the prescription.
2. FOR ALL invoices, THE Bill_Total stored in `hms_invoices` SHALL equal the sum of all associated line item amounts at the time of invoice creation and after any line item modification.
3. FOR ALL bed assignments, THE HMS SHALL enforce that a bed ID in `hms_beds` is linked to at most one active admission record in `hms_admissions` at any point in time.
4. FOR ALL SHA/NHIF claims, THE Claim_Amount SHALL NOT exceed the benefit limit configured for the patient's scheme in `hms_insurance_schemes`.
5. FOR ALL dispensing actions, THE HMS SHALL verify that the resulting stock quantity is greater than or equal to zero before committing the transaction; IF the quantity would go negative, THEN THE HMS SHALL roll back the transaction and return an error.
6. FOR ALL investigation results, THE HMS SHALL verify that the referenced investigation request ID exists in `hms_investigation_requests` before saving the result; IF the reference is invalid, THEN THE HMS SHALL return HTTP 422 and reject the result.
7. WHEN a parser reads a structured visit form JSON from the database and the Pretty_Printer formats it back to JSON, THE HMS SHALL produce an equivalent JSON object (round-trip property).

---

### Requirement 20: Kenya-Specific Compliance

**User Story:** As a Kenya-based facility operator, I want the system to comply with Kenya-specific regulatory and operational requirements, so that the facility can operate legally and integrate with national health systems.

#### Acceptance Criteria

1. THE HMS SHALL display all monetary values in KES with the "KES" prefix or "Ksh" abbreviation throughout the UI.
2. THE HMS SHALL include the SHA number field on all patient registration and encounter forms.
3. THE HMS SHALL populate county and sub-county dropdowns from the official list of 47 Kenya counties and their sub-counties.
4. THE HMS SHALL include the facility's KRA PIN on all printed receipts and invoices.
5. WHEN an M-Pesa STK Push payment is initiated, THE HMS SHALL use the configured M-Pesa shortcode and display the Safaricom payment prompt reference number to the user.
6. WHEN Africa's_Talking SMS is sent, THE HMS SHALL use the configured SMS sender ID registered with the Communications Authority of Kenya.
7. THE HMS SHALL support SHA benefit package claim formats as defined by the Social Health Authority of Kenya.
