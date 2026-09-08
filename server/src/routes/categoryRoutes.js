import { Router } from 'express';
import { listCategories, createCategory } from '../controllers/categoryController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(listCategories));
router.post('/', asyncHandler(createCategory));

export default router;
