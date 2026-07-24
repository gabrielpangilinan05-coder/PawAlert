import nodemailer from "nodemailer";

export type MailSendResult =
  | { ok: true; mode: "dev" | "gmail" }
  | { ok: false; error: string };

/** When not explicitly false, codes are logged and not emailed (local/dev). */
function mailDevMode(): boolean {
  return process.env.MAIL_DEV_MODE !== "false";
}

/** Send email via Gmail SMTP when configured; otherwise log for local/dev. */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<MailSendResult> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    (user ? `PawAlert <${user}>` : "PawAlert <noreply@pawalert.local>");

  if (mailDevMode()) {
    console.info(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return { ok: true, mode: "dev" };
  }

  if (!user || !pass) {
    console.error("[mail] MAIL_DEV_MODE=false but SMTP_USER / SMTP_PASS missing");
    return {
      ok: false,
      error: "Email is not configured. Add SMTP_USER and SMTP_PASS (Gmail App Password) on the server.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== "false",
      auth: { user, pass },
    });

    await transporter.sendMail({ from, to, subject, text });
    return { ok: true, mode: "gmail" };
  } catch (err) {
    console.error("[mail:gmail]", err);
    return { ok: false, error: "Could not send email. Try again." };
  }
}

export async function sendOtpEmail(to: string, code: string, purpose: "register" | "reset") {
  const subject =
    purpose === "reset" ? "PawAlert password reset code" : "PawAlert verification code";
  const text =
    purpose === "reset"
      ? `Your PawAlert password reset code is ${code}. It is valid for 10 minutes. Do not share this code.`
      : `Your PawAlert verification code is ${code}. It is valid for 10 minutes. Do not share this code.`;
  return sendEmail(to, subject, text);
}
