import { Router } from 'express';
import { listGoals } from '../controllers/goalController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(listGoals));

export default router;
