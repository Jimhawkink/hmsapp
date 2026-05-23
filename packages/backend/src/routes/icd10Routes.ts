import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Load ICD-10 data once at startup
const icd10DataPath = path.join(__dirname, '../data/icd10_kenya.json');
let icd10Data: Array<{ code: string; description: string }> = [];

try {
  const raw = fs.readFileSync(icd10DataPath, 'utf-8');
  icd10Data = JSON.parse(raw);
  console.log(`✅ ICD-10 data loaded: ${icd10Data.length} entries`);
} catch (err) {
  console.error('❌ Failed to load ICD-10 data:', err);
}

/**
 * GET /api/icd10/search?q=malaria
 * Case-insensitive substring search on code and description.
 * Returns up to 20 results. In-memory — no DB round-trip.
 */
router.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();

  if (q.length < 2) {
    return res.json([]);
  }

  const lower = q.toLowerCase();
  const results = icd10Data
    .filter(
      (entry) =>
        entry.code.toLowerCase().includes(lower) ||
        entry.description.toLowerCase().includes(lower)
    )
    .slice(0, 20);

  res.json(results);
});

export default router;
