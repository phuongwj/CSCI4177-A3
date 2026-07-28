import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const validateBody = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const key = issue.path.join('.') || '_root';
            if (!(key in fields)) {
                fields[key] = issue.message;
            }
        }
        return res.status(400).json({ error: 'Validation failed.', fields });
    }

    req.body = result.data;
    next();
};

export const validateQuery = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const key = issue.path.join('.') || '_root';
            if (!(key in fields)) {
                fields[key] = issue.message;
            }
        }
        return res.status(400).json({ error: 'Validation failed.', fields });
    }

    (req as any).validatedQuery = result.data;
    next();
};

export const validateParams = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
            const key = issue.path.join('.') || '_root';
            if (!(key in fields)) {
                fields[key] = issue.message;
            }
        }
        return res.status(400).json({ error: 'Validation failed.', fields });
    }

    (req as any).validatedParams = result.data;
    next();
};
