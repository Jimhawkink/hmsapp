import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';
import { sendSMS, sendBulkSMS } from '../services/smsService';

const SMS_TEMPLATES = [
  { id: 1, name: 'Appointment Reminder', body: 'Dear {name}, you have an appointment on {date} at {time}. Please arrive 15 minutes early. Call us if you need to reschedule.' },
  { id: 2, name: 'Lab Results Ready', body: 'Dear {name}, your lab results are ready. Please visit us to collect them or call for more information.' },
  { id: 3, name: 'Payment Receipt', body: 'Dear {name}, we confirm receipt of KES {amount} on {date}. Receipt No: {receipt_no}. Thank you.' },
  { id: 4, name: 'Follow-up Reminder', body: 'Dear {name}, this is a reminder for your follow-up visit on {date}. Please do not miss your appointment.' },
  { id: 5, name: 'General Notification', body: 'Dear {name}, {message}. For enquiries call us. Thank you.' },
];

// ─── Send Single SMS ──────────────────────────────────────────────────────────
export const sendSingleSMS = async (req: Request, res: Response) => {
  try {
    const { phone, message, patient_id, recipient_name } = req.body;
    if (!phone || !message) return res.status(400).json({ message: 'phone and message required' });

    let status = 'Sent';
    let providerMessageId = '';
    let errorReason = '';

    try {
      const result = await sendSMS(phone, message);
      status = result.status;
      providerMessageId = result.messageId;
    } catch (err: any) {
      status = 'Failed';
      errorReason = err.message || 'Unknown error';
    }

    // Log to hms_sms_log
    await sequelize.query(
      `INSERT INTO hms_sms_log
         (recipient_phone, recipient_name, patient_id, message_body, message_type, status, provider_message_id, error_reason, sent_by)
       VALUES ($1,$2,$3,$4,'Custom',$5,$6,$7,$8)`,
      { bind: [phone, recipient_name || null, patient_id || null, message, status, providerMessageId || null, errorReason || null, (req as any).user?.name || 'System'] }
    );

    if (status === 'Failed') {
      return res.status(502).json({ message: 'SMS failed to send', error: errorReason });
    }

    res.json({ message: 'SMS sent', status, messageId: providerMessageId });
  } catch (err) {
    console.error('sendSingleSMS error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Send Bulk SMS ────────────────────────────────────────────────────────────
export const sendBulkSMSHandler = async (req: Request, res: Response) => {
  try {
    const { message, patient_ids, tag_id } = req.body;
    if (!message) return res.status(400).json({ message: 'message required' });

    let patients: any[] = [];

    if (patient_ids && Array.isArray(patient_ids)) {
      patients = await sequelize.query(
        `SELECT id, first_name || ' ' || last_name AS name, phone FROM hms_patients WHERE id = ANY($1::int[]) AND phone IS NOT NULL`,
        { bind: [patient_ids], type: QueryTypes.SELECT }
      );
    } else {
      // All patients with phone numbers
      patients = await sequelize.query(
        `SELECT id, first_name || ' ' || last_name AS name, phone FROM hms_patients WHERE phone IS NOT NULL LIMIT 500`,
        { type: QueryTypes.SELECT }
      );
    }

    if (patients.length === 0) return res.status(400).json({ message: 'No recipients found' });

    const phones = patients.map((p: any) => p.phone);
    const result = await sendBulkSMS(phones, message);

    // Log each
    for (const patient of patients) {
      await sequelize.query(
        `INSERT INTO hms_sms_log (recipient_phone, recipient_name, patient_id, message_body, message_type, status, sent_by)
         VALUES ($1,$2,$3,$4,'Bulk','Sent',$5)`,
        { bind: [(patient as any).phone, (patient as any).name, (patient as any).id, message, (req as any).user?.name || 'System'] }
      );
    }

    res.json({ message: 'Bulk SMS sent', sent: result.sent, failed: result.failed, total: patients.length });
  } catch (err) {
    console.error('sendBulkSMS error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── SMS History ──────────────────────────────────────────────────────────────
export const getSMSHistory = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const rows = await sequelize.query(
      `SELECT l.*, p.first_name || ' ' || p.last_name AS patient_name
       FROM hms_sms_log l
       LEFT JOIN hms_patients p ON l.patient_id = p.id
       ORDER BY l.created_at DESC LIMIT $1`,
      { bind: [limit], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const getTemplates = async (_req: Request, res: Response) => {
  res.json(SMS_TEMPLATES);
};
