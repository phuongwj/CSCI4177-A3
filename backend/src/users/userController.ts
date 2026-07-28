import { Request, Response } from "express";
import { z } from "zod";
import pool from "../config/db.ts";

// ── Schemas ─────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required.").optional(),
    lastName: z.string().trim().min(1, "Last name is required.").optional(),
}).refine(data => data.firstName || data.lastName, {
    message: "At least one field (firstName or lastName) must be provided.",
});

// ── Handlers ────────────────────────────────────────────────────────

export const updateMe = async (req: Request, res: Response) => {
    const { firstName, lastName } = req.body;

    try {
        const query = `
            UPDATE users
            SET first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                updated_at = now()
            WHERE id = $3
            RETURNING id, first_name AS "firstName", last_name AS "lastName", email
        `;
        const result = await pool.query(query, [firstName ?? null, lastName ?? null, req.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        return res.status(200).json({ user: result.rows[0] });
    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ error: 'Something went wrong updating your profile.' });
    }
};

export const deleteMe = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.clearCookie('refresh_token', { path: '/api/auth' });
        return res.status(200).json({ message: 'Account deleted.' });
    } catch (err) {
        console.error('Delete account error:', err);
        return res.status(500).json({ error: 'Something went wrong deleting your account.' });
    }
};
