import { Router } from 'express';
import { getClaims, generateClaim, getClaimDetail, updateClaimStatus } from '../controllers/claimController';

const router = Router();

router.get('/', getClaims);
router.post('/', generateClaim);
router.get('/:id', getClaimDetail);
router.patch('/:id/status', updateClaimStatus);

export default router;
