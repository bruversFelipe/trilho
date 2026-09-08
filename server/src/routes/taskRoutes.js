import { Router } from 'express';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  getStats,
} from '../controllers/taskController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/stats', asyncHandler(getStats));
router.get('/', asyncHandler(listTasks));
router.post('/', asyncHandler(createTask));
router.put('/:id', asyncHandler(updateTask));
router.delete('/:id', asyncHandler(deleteTask));
router.patch('/:id/complete', asyncHandler(completeTask));

export default router;
