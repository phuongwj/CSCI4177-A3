import express from 'express';
import {
    createGroup, joinGroup, listGroups, getGroup,
    regenerateCode, removeMember, deleteGroup,
    createGroupSchema, joinGroupSchema, uuidParamSchema, memberRemoveParamSchema,
} from "./groupController.ts";
import { validateBody, validateParams } from "../middleware/validateRequest.ts";
import { requireAuth } from "../middleware/authMiddleware.ts";

const router = express.Router();

router.post('/', requireAuth, validateBody(createGroupSchema), createGroup);
router.post('/join', requireAuth, validateBody(joinGroupSchema), joinGroup);
router.get('/', requireAuth, listGroups);
router.get('/:id', requireAuth, validateParams(uuidParamSchema), getGroup);
router.patch('/:id/regenerate-code', requireAuth, validateParams(uuidParamSchema), regenerateCode);
router.delete('/:id/members/:userId', requireAuth, validateParams(memberRemoveParamSchema), removeMember);
router.delete('/:id', requireAuth, validateParams(uuidParamSchema), deleteGroup);

export default router;
