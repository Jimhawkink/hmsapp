import dotenv from 'dotenv';
dotenv.config();

interface SMSResult {
  status: string;
  messageId: string;
  cost?: string;
  statusCode?: number;
}

interface ATSMSRecipient {
  number: string;
  status: string;
  cost: string;
  messageId: string;
  statusCode: number;
}

/**
 * Send an SMS via Africa's Talking API.
 * Falls back to console log in development if AT credentials are not set.
 */
export const sendSMS = async (to: string, message: string): Promise<SMSResult> => {
  const apiKey = process.env.AT_API_KEY || '';
  const username = process.env.AT_USERNAME || '';
  const senderId = process.env.AT_SENDER_ID || '';

  if (!apiKey || !username) {
    // Development fallback — log instead of sending
    console.log(`[SMS DEV] To: ${to} | Message: ${message}`);
    return { status: 'Sent', messageId: `dev-${Date.now()}` };
  }

  try {
    // Dynamic import to avoid hard dependency if package not installed
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({ apiKey, username });
    const sms = at.SMS;

    const options: Record<string, any> = { to: [to], message };
    if (senderId) options.from = senderId;

    const response = await sms.send(options);
    const recipients: ATSMSRecipient[] = response?.SMSMessageData?.Recipients || [];

    if (recipients.length === 0) {
      throw new Error('No recipients in AT response');
    }

    const first = recipients[0];
    return {
      status: first.status === 'Success' ? 'Sent' : 'Failed',
      messageId: first.messageId,
      cost: first.cost,
      statusCode: first.statusCode,
    };
  } catch (err: any) {
    const reason = err?.message || 'Unknown AT error';
    throw new Error(`SMS_FAILED: ${reason}`);
  }
};

/**
 * Send bulk SMS to multiple recipients.
 */
export const sendBulkSMS = async (
  recipients: string[],
  message: string
): Promise<{ sent: number; failed: number; results: SMSResult[] }> => {
  const results: SMSResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const phone of recipients) {
    try {
      const result = await sendSMS(phone, message);
      results.push(result);
      if (result.status === 'Sent') sent++;
      else failed++;
    } catch {
      failed++;
      results.push({ status: 'Failed', messageId: '' });
    }
  }

  return { sent, failed, results };
};
