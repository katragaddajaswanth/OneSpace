
import nodemailer from "nodemailer";

type OtpPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

interface SendOtpEmailParams {
  to: string;
  code: string;
  purpose: OtpPurpose;
}

export async function sendOtpEmail({
  to,
  code,
  purpose,
}: SendOtpEmailParams) {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider !== "gmail") {
    throw new Error("Gmail SMTP is not configured");
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM?.trim();

  if (host !== "smtp.gmail.com" || !Number.isInteger(port) || port !== 587 || secure !== "false") {
    throw new Error("Gmail SMTP configuration is invalid");
  }
  if (!user || !pass || !from) {
    throw new Error("Gmail SMTP credentials are incomplete");
  }
  const senderAddress = from.match(/<([^>]+)>/)?.[1] ?? from;
  if (senderAddress.toLowerCase() !== user.toLowerCase()) {
    console.warn("EMAIL_FROM_MISMATCH_USING_AUTHENTICATED_GMAIL");
  }
  const sender = senderAddress.toLowerCase() === user.toLowerCase()
    ? from
    : `One-Space <${user}>`;

  if (!/^\d{6}$/.test(code)) {
    throw new Error("OTP must contain exactly 6 digits");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });

  const subject =
    purpose === "EMAIL_VERIFICATION"
      ? "Verify your One-Space account"
      : "Reset your One-Space password";

  const heading =
    purpose === "EMAIL_VERIFICATION"
      ? "Verify your email address"
      : "Password reset verification";

  const html = `
    <div style="margin:0;padding:32px;background:#f1f5f9;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:18px;border:1px solid #e2e8f0;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:24px 28px;color:#ffffff;">
          <div style="font-size:20px;font-weight:700;">One-Space</div>
          <div style="margin-top:4px;font-size:12px;color:#bfdbfe;">Your university. Connected.</div>
        </div>
        <div style="padding:28px;">
          <h1 style="margin:0;font-size:22px;color:#0f172a;">${heading}</h1>
          <p style="margin:16px 0;color:#475569;font-size:14px;line-height:22px;">Use the following verification code to continue:</p>
          <div style="margin:20px 0;padding:18px;border-radius:12px;background:#eff6ff;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#1d4ed8;">${code}</div>
          <p style="margin:16px 0;color:#475569;font-size:13px;line-height:20px;"><strong>This code expires in 5 minutes.</strong></p>
          <p style="margin:16px 0;color:#64748b;font-size:12px;line-height:19px;">Never share this code. One-Space staff will never ask for it. If you did not request this email, ignore it and do not share the code.</p>
        </div>
      </div>
    </div>
  `;
  const text = `${heading}\n\nOne-Space verification code: ${code}\n\nThis code expires in 5 minutes.\nNever share this code. One-Space staff will never ask for it.\nIf you did not request this email, ignore it.\n`;

  let result;
  try {
    result = await transporter.sendMail({
      from: sender,
      to,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error("GMAIL_SMTP_DELIVERY_FAILED");
    throw new Error("Gmail SMTP delivery failed");
  } finally {
    transporter.close();
  }

  return {
    success: true,
    messageId: result?.messageId,
  };
}
