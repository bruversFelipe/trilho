import { Router } from 'express';
import { register, login, checkSlug } from '../controllers/authController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/slug-availability', asyncHandler(checkSlug));
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));

export default router;
