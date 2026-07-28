import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import pool from "../config/db.ts";

// ── Schemas ─────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
    name: z.string().trim().min(1, "Group name is required.").max(255),
});

export const joinGroupSchema = z.object({
    joinCode: z.string().min(1, "Join code is required."),
});

export const uuidParamSchema = z.object({
    id: z.string().uuid("A valid group id is required."),
});

export const memberRemoveParamSchema = z.object({
    id: z.string().uuid("A valid group id is required."),
    userId: z.string().uuid("A valid user id is required."),
});

// ── Cache ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5000;
const groupsCache = new Map<string, { data: any; expiresAt: number }>();

const getCached = (key: string) => {
    const entry = groupsCache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    groupsCache.delete(key);
    return null;
};

const setCache = (key: string, data: any) => {
    groupsCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const invalidateUserCache = (userId: string) => {
    groupsCache.delete(`list:${userId}`);
};

// ── Helpers ─────────────────────────────────────────────────────────

const generateJoinCode = (): string => {
    return randomBytes(4).toString('hex').toUpperCase();
};

// ── Handlers ────────────────────────────────────────────────────────

export const createGroup = async (req: Request, res: Response) => {
    const { name } = req.body;

    try {
        const joinCode = generateJoinCode();

        const groupResult = await pool.query(
            `INSERT INTO groups (name, join_code, created_by)
             VALUES ($1, $2, $3)
             RETURNING id, name, join_code AS "joinCode", created_by AS "createdBy", created_at AS "createdAt"`,
            [name, joinCode, req.userId]
        );
        const group = groupResult.rows[0];

        await pool.query(
            `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')`,
            [group.id, req.userId]
        );

        invalidateUserCache(req.userId!);
        return res.status(201).json({ group });
    } catch (err: any) {
        if (err.code === '23505' && err.constraint?.includes('join_code')) {
            const retryCode = generateJoinCode();
            try {
                const groupResult = await pool.query(
                    `INSERT INTO groups (name, join_code, created_by)
                     VALUES ($1, $2, $3)
                     RETURNING id, name, join_code AS "joinCode", created_by AS "createdBy", created_at AS "createdAt"`,
                    [name, retryCode, req.userId]
                );
                const group = groupResult.rows[0];
                await pool.query(
                    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'leader')`,
                    [group.id, req.userId]
                );
                invalidateUserCache(req.userId!);
                return res.status(201).json({ group });
            } catch (retryErr) {
                console.error('Create group retry error:', retryErr);
                return res.status(500).json({ error: 'Something went wrong creating the group.' });
            }
        }
        console.error('Create group error:', err);
        return res.status(500).json({ error: 'Something went wrong creating the group.' });
    }
};

export const joinGroup = async (req: Request, res: Response) => {
    const { joinCode } = req.body;

    try {
        const groupResult = await pool.query(
            `SELECT id, name FROM groups WHERE join_code = $1`,
            [joinCode]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid join code.' });
        }

        const group = groupResult.rows[0];

        const memberCheck = await pool.query(
            `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [group.id, req.userId]
        );

        if (memberCheck.rows.length > 0) {
            return res.status(409).json({ error: "You're already in this group." });
        }

        await pool.query(
            `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')`,
            [group.id, req.userId]
        );

        invalidateUserCache(req.userId!);
        return res.status(200).json({
            group: { id: group.id, name: group.name, role: 'member' },
        });
    } catch (err) {
        console.error('Join group error:', err);
        return res.status(500).json({ error: 'Something went wrong joining the group.' });
    }
};

export const listGroups = async (req: Request, res: Response) => {
    try {
        const cacheKey = `list:${req.userId}`;
        const cached = getCached(cacheKey);
        if (cached) return res.status(200).json({ groups: cached });

        const result = await pool.query(
            `SELECT g.id, g.name, gm.role
             FROM groups g
             JOIN group_members gm ON g.id = gm.group_id
             WHERE gm.user_id = $1
             ORDER BY g.created_at DESC`,
            [req.userId]
        );

        setCache(cacheKey, result.rows);
        return res.status(200).json({ groups: result.rows });
    } catch (err) {
        console.error('List groups error:', err);
        return res.status(500).json({ error: 'Something went wrong fetching your groups.' });
    }
};

export const getGroup = async (req: Request, res: Response) => {
    const { id } = (req as any).validatedParams;

    try {
        const groupResult = await pool.query(
            `SELECT id, name, join_code AS "joinCode", created_by AS "createdBy", created_at AS "createdAt"
             FROM groups WHERE id = $1`,
            [id]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found.' });
        }

        const group = groupResult.rows[0];

        const membershipResult = await pool.query(
            `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [id, req.userId]
        );

        if (membershipResult.rows.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group.' });
        }

        const requesterRole = membershipResult.rows[0].role;

        const membersResult = await pool.query(
            `SELECT u.id AS "userId", u.first_name AS "firstName", u.last_name AS "lastName",
                    gm.role, gm.joined_at AS "joinedAt"
             FROM group_members gm
             JOIN users u ON gm.user_id = u.id
             WHERE gm.group_id = $1
             ORDER BY gm.joined_at`,
            [id]
        );

        const response: any = {
            group: {
                id: group.id,
                name: group.name,
                createdBy: group.createdBy,
                createdAt: group.createdAt,
            },
            members: membersResult.rows,
        };

        if (requesterRole === 'leader') {
            response.group.joinCode = group.joinCode;
        }

        return res.status(200).json(response);
    } catch (err) {
        console.error('Get group error:', err);
        return res.status(500).json({ error: 'Something went wrong fetching the group.' });
    }
};

export const regenerateCode = async (req: Request, res: Response) => {
    const { id } = (req as any).validatedParams;

    try {
        const groupResult = await pool.query(`SELECT id FROM groups WHERE id = $1`, [id]);

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found.' });
        }

        const membershipResult = await pool.query(
            `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [id, req.userId]
        );

        if (membershipResult.rows.length === 0 || membershipResult.rows[0].role !== 'leader') {
            return res.status(403).json({ error: 'Only the group leader can perform this action.' });
        }

        const newCode = generateJoinCode();
        await pool.query(`UPDATE groups SET join_code = $1 WHERE id = $2`, [newCode, id]);

        return res.status(200).json({ joinCode: newCode });
    } catch (err) {
        console.error('Regenerate code error:', err);
        return res.status(500).json({ error: 'Something went wrong regenerating the code.' });
    }
};

export const removeMember = async (req: Request, res: Response) => {
    const { id: groupId, userId: targetUserId } = (req as any).validatedParams;

    try {
        const requesterMembership = await pool.query(
            `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [groupId, req.userId]
        );

        if (requesterMembership.rows.length === 0) {
            return res.status(403).json({ error: "You don't have permission to remove this member." });
        }

        const requesterRole = requesterMembership.rows[0].role;
        const isSelfRemoval = req.userId === targetUserId;

        if (!isSelfRemoval && requesterRole !== 'leader') {
            return res.status(403).json({ error: "You don't have permission to remove this member." });
        }

        const targetMembership = await pool.query(
            `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [groupId, targetUserId]
        );

        if (targetMembership.rows.length === 0) {
            return res.status(404).json({ error: 'Member not found in group.' });
        }

        if (targetMembership.rows[0].role === 'leader') {
            const memberCount = await pool.query(
                `SELECT COUNT(*) AS count FROM group_members WHERE group_id = $1`,
                [groupId]
            );

            if (Number(memberCount.rows[0].count) > 1) {
                return res.status(409).json({ error: 'Transfer leadership before leaving the group.' });
            }
        }

        await pool.query(
            `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [groupId, targetUserId]
        );

        return res.status(200).json({ message: 'Member removed.' });
    } catch (err) {
        console.error('Remove member error:', err);
        return res.status(500).json({ error: 'Something went wrong removing the member.' });
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    const { id } = (req as any).validatedParams;

    try {
        const membershipResult = await pool.query(
            `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
            [id, req.userId]
        );

        if (membershipResult.rows.length === 0 || membershipResult.rows[0].role !== 'leader') {
            return res.status(403).json({ error: 'Only the group leader can delete this group.' });
        }

        await pool.query(`DELETE FROM groups WHERE id = $1`, [id]);

        return res.status(200).json({ message: 'Group deleted.' });
    } catch (err) {
        console.error('Delete group error:', err);
        return res.status(500).json({ error: 'Something went wrong deleting the group.' });
    }
};
