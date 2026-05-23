import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

// ─── Claims ───────────────────────────────────────────────────────────────────
export const getClaims = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT c.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              s.scheme_name, s.scheme_code,
              e.encounter_number
       FROM hms_claims c
       JOIN hms_patients p ON c.patient_id = p.id
       JOIN hms_insurance_schemes s ON c.scheme_id = s.id
       JOIN hms_encounters e ON c.encounter_id = e.id
       ORDER BY c.created_at DESC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const generateClaim = async (req: Request, res: Response) => {
  try {
    const { patient_id, encounter_id, scheme_id, items, pre_auth_number, notes } = req.body;
    if (!patient_id || !encounter_id || !scheme_id) {
      return res.status(400).json({ message: 'patient_id, encounter_id, scheme_id required' });
    }

    // Get scheme benefit limit
    const [scheme]: any = await sequelize.query(
      'SELECT * FROM hms_insurance_schemes WHERE id = $1',
      { bind: [scheme_id], type: QueryTypes.SELECT }
    );
    if (!scheme) return res.status(404).json({ message: 'Insurance scheme not found' });

    const benefitPackages = typeof scheme.benefit_packages === 'string'
      ? JSON.parse(scheme.benefit_packages) : (scheme.benefit_packages || []);

    // Calculate total and apply benefit cap (Property 4)
    let totalRequested = (items || []).reduce((sum: number, item: any) => sum + Number(item.total_cost || 0), 0);
    const allServicesLimit = benefitPackages.find((b: any) => b.service === 'All Services');
    const benefitLimit = allServicesLimit ? Number(allServicesLimit.limit) : Infinity;
    const claimedAmount = Math.min(totalRequested, benefitLimit);
    const wasCapped = claimedAmount < totalRequested;

    const claimNumber = `CLM-${Date.now()}`;
    const [claim]: any = await sequelize.query(
      `INSERT INTO hms_claims
         (patient_id, encounter_id, scheme_id, claim_number, claimed_amount, pre_auth_number, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      { bind: [patient_id, encounter_id, scheme_id, claimNumber, claimedAmount, pre_auth_number || null, notes || null],
        type: QueryTypes.SELECT }
    );

    // Insert claim items
    for (const item of (items || [])) {
      const itemClaimed = Math.min(Number(item.total_cost || 0), Number(item.total_cost || 0));
      await sequelize.query(
        `INSERT INTO hms_claim_items (claim_id, service_name, service_code, quantity, unit_cost, total_cost, claimed_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        { bind: [claim.id, item.service_name, item.service_code || null, item.quantity || 1,
                 item.unit_cost || 0, item.total_cost || 0, itemClaimed] }
      );
    }

    res.status(201).json({ ...claim, was_capped: wasCapped, original_amount: totalRequested });
  } catch (err) {
    console.error('generateClaim error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getClaimDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [claim]: any = await sequelize.query(
      `SELECT c.*, p.first_name || ' ' || p.last_name AS patient_name,
              s.scheme_name, e.encounter_number
       FROM hms_claims c
       JOIN hms_patients p ON c.patient_id = p.id
       JOIN hms_insurance_schemes s ON c.scheme_id = s.id
       JOIN hms_encounters e ON c.encounter_id = e.id
       WHERE c.id = $1`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const items = await sequelize.query(
      'SELECT * FROM hms_claim_items WHERE claim_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json({ ...claim, items });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const updateClaimStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approved_amount, paid_amount, rejection_reason } = req.body;
    const valid = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    await sequelize.query(
      `UPDATE hms_claims SET status=$1, approved_amount=$2, paid_amount=$3,
       rejection_reason=$4,
       submission_date = CASE WHEN $1 = 'Submitted' THEN NOW() ELSE submission_date END,
       payment_date = CASE WHEN $1 = 'Paid' THEN NOW() ELSE payment_date END,
       updated_at=NOW() WHERE id=$5`,
      { bind: [status, approved_amount || 0, paid_amount || 0, rejection_reason || null, id] }
    );
    res.json({ message: 'Claim status updated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
