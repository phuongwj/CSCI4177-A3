import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL as string;

export const sendPasswordResetEmail = async (to: string, code: string): Promise<void> => {
    await resend.emails.send({
        from: fromEmail,
        to,
        subject: "Your password reset code",
        html: `
            <p>Your password reset code is:</p>
            <h1 style="letter-spacing: 4px; font-size: 32px;">${code}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        `,
    });
};
