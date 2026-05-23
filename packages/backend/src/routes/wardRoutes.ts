import { Router } from 'express';
import { getWards, createWard, getWardBeds, addBed, updateBedStatus } from '../controllers/wardController';

const router = Router();

router.get('/', getWards);
router.post('/', createWard);
router.get('/:id/beds', getWardBeds);
router.post('/:id/beds', addBed);
router.patch('/:id/beds/:bedId', updateBedStatus);

export default router;
