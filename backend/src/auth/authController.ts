import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { randomBytes, randomInt, createHash } from "crypto";
import { z } from "zod";
import pool from "../config/db.ts";
import { sendPasswordResetEmail } from "../config/email.ts";

// ── Interfaces ──────────────────────────────────────────────────────

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    password_hash: string;
    created_at: Date;
}

type PublicUser = Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;

const toPublicUser = (user: PublicUser): PublicUser => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
});

interface RefreshToken {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    replacedByTokenId: string | null;
    createdAt: Date;
}

interface PasswordResetToken {
    id: string;
    userId: string;
    codeHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    attempts: number;
    createdAt: Date;
}

// ── Zod Schemas ─────────────────────────────────────────────────────

export const signupSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    email: z.string().trim().toLowerCase().email("A valid email is required."),
    // bcrypt silently truncates at 72 bytes
    password: z.string().min(8, "Password must be at least 8 characters.")
        .max(72, "Password must be at most 72 characters."),
});
type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("A valid email is required."),
    password: z.string().min(1, "Password is required."),
});
type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("A valid email is required."),
});
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("A valid email is required."),
    code: z.string().regex(/^\d{6}$/, "Code must be 6 digits."),
    password: z.string().min(8, "Password must be at least 8 characters.")
        .max(72, "Password must be at most 72 characters."),
});
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── SQL Queries ─────────────────────────────────────────────────────

const findUserByEmail = async (email: string): Promise<User | null> => {
    const result = await pool.query(
        `SELECT id, email, password_hash, first_name AS "firstName", last_name AS "lastName", created_at
         FROM users
         WHERE email = $1`,
        [email]
    );
    return result.rows[0] || null;
};

const createUser = async (
    firstName: string,
    lastName: string,
    email: string,
    passwordHash: string
): Promise<PublicUser> => {
    const result = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, first_name AS "firstName", last_name AS "lastName", email`,
        [firstName, lastName, email, passwordHash]
    );
    return result.rows[0];
};

const insertRefreshToken = async (
    userId: string,
    tokenHash: string,
    expiresAt: Date
): Promise<RefreshToken> => {
    const result = await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, user_id AS "userId", token_hash AS "tokenHash", expires_at AS "expiresAt",
                   revoked_at AS "revokedAt", replaced_by_token_id AS "replacedByTokenId", created_at AS "createdAt"`,
        [userId, tokenHash, expiresAt]
    );
    return result.rows[0];
};

const findRefreshTokenByHash = async (tokenHash: string): Promise<RefreshToken | null> => {
    const result = await pool.query(
        `SELECT id, user_id AS "userId", token_hash AS "tokenHash", expires_at AS "expiresAt",
                revoked_at AS "revokedAt", replaced_by_token_id AS "replacedByTokenId", created_at AS "createdAt"
         FROM refresh_tokens
         WHERE token_hash = $1`,
        [tokenHash]
    );
    return result.rows[0] || null;
};

const revokeRefreshToken = async (id: string, replacedByTokenId?: string): Promise<void> => {
    await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = now(), replaced_by_token_id = $2
         WHERE id = $1`,
        [id, replacedByTokenId ?? null]
    );
};

const revokeAllUserRefreshTokens = async (userId: string): Promise<void> => {
    await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = now()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
    );
};

const findUserById = async (userId: string): Promise<PublicUser | null> => {
    const result = await pool.query(
        `SELECT id, first_name AS "firstName", last_name AS "lastName", email
         FROM users
         WHERE id = $1`,
        [userId]
    );
    return result.rows[0] || null;
};

const insertPasswordResetToken = async (
    userId: string,
    codeHash: string,
    expiresAt: Date
): Promise<PasswordResetToken> => {
    const result = await pool.query(
        `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, user_id AS "userId", code_hash AS "codeHash",
                   expires_at AS "expiresAt", used_at AS "usedAt", attempts, created_at AS "createdAt"`,
        [userId, codeHash, expiresAt]
    );
    return result.rows[0];
};

const findActiveResetTokenByUser = async (userId: string): Promise<PasswordResetToken | null> => {
    const result = await pool.query(
        `SELECT id, user_id AS "userId", code_hash AS "codeHash",
                expires_at AS "expiresAt", used_at AS "usedAt", attempts, created_at AS "createdAt"
         FROM password_reset_tokens
         WHERE user_id = $1 AND used_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
};

const incrementResetTokenAttempts = async (tokenId: string): Promise<void> => {
    await pool.query(
        `UPDATE password_reset_tokens
         SET attempts = attempts + 1
         WHERE id = $1`,
        [tokenId]
    );
};

const markAllUserResetTokensUsed = async (userId: string): Promise<void> => {
    await pool.query(
        `UPDATE password_reset_tokens
         SET used_at = now()
         WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
    );
};

const updateUserPassword = async (userId: string, passwordHash: string): Promise<void> => {
    await pool.query(
        `UPDATE users
         SET password_hash = $1, updated_at = now()
         WHERE id = $2`,
        [passwordHash, userId]
    );
};

// ── Constants & Helpers ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET as string;
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES) || 10;
const MAX_RESET_ATTEMPTS = 5;
const COOKIE_NAME = 'refresh_token';

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
};

const hashToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex');

const issueTokenPair = async (userId: string) => {
    const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const refreshToken = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const refreshTokenRecord = await insertRefreshToken(userId, hashToken(refreshToken), expiresAt);

    return { accessToken, refreshToken, refreshTokenRecord };
};

// ── Handlers ────────────────────────────────────────────────────────

export const signUp = async (req: Request<{}, {}, SignupInput>, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser(firstName, lastName, email, passwordHash);
    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      message: 'Account created.',
      accessToken,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Something went wrong creating your account.' });
  }
};

export const logIn = async (req: Request<{}, {}, LoginInput>, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: 'Logged in successfully.',
      accessToken,
      user: toPublicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong logging you in.' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];

  if (!refreshToken) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }

  try {
    const existingToken = await findRefreshTokenByHash(hashToken(refreshToken));

    if (!existingToken || existingToken.revokedAt || existingToken.expiresAt.getTime() < Date.now()) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const issued = await issueTokenPair(existingToken.userId);
    await revokeRefreshToken(existingToken.id, issued.refreshTokenRecord.id);
    setRefreshCookie(res, issued.refreshToken);

    return res.status(200).json({
      accessToken: issued.accessToken,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Something went wrong refreshing your session.' });
  }
};

export const logOut = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];

  try {
    if (refreshToken) {
      const existingToken = await findRefreshTokenByHash(hashToken(refreshToken));

      if (existingToken) {
        await revokeAllUserRefreshTokens(existingToken.userId);
      }
    }

    clearRefreshCookie(res);
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Something went wrong logging you out.' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await findUserById(req.userId!);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user: toPublicUser(user) });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Something went wrong retrieving your profile.' });
  }
};

export const forgotPassword = async (req: Request<{}, {}, ForgotPasswordInput>, res: Response) => {
  const { email } = req.body;

  try {
    const user = await findUserByEmail(email);

    if (user) {
      await markAllUserResetTokensUsed(user.id);

      const otp = String(randomInt(100000, 999999));
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await insertPasswordResetToken(user.id, hashToken(otp), expiresAt);

      await sendPasswordResetEmail(email, otp);
    }

    return res.status(200).json({
      message: 'If an account with that email exists, a verification code has been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Something went wrong processing your request.' });
  }
};

export const resetPassword = async (req: Request<{}, {}, ResetPasswordInput>, res: Response) => {
  const { email, code, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const tokenRecord = await findActiveResetTokenByUser(user.id);

    if (!tokenRecord) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    if (tokenRecord.attempts >= MAX_RESET_ATTEMPTS) {
      await markAllUserResetTokensUsed(user.id);
      return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });
    }

    if (hashToken(code) !== tokenRecord.codeHash) {
      await incrementResetTokenAttempts(tokenRecord.id);
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await updateUserPassword(user.id, passwordHash);
    await markAllUserResetTokensUsed(user.id);
    await revokeAllUserRefreshTokens(user.id);

    return res.status(200).json({
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Something went wrong resetting your password.' });
  }
};
