import express from 'express';
import { updateMe, deleteMe, updateProfileSchema } from "./userController.ts";
import { validateBody } from "../middleware/validateRequest.ts";
import { requireAuth } from "../middleware/authMiddleware.ts";

const router = express.Router();

router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);
router.delete('/me', requireAuth, deleteMe);

export default router;
