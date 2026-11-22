import "dotenv/config";
import nodemailer from "nodemailer";

const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS;

if (!user || !pass) {
  throw new Error("Gmail SMTP credentials are incomplete");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass },
});

const result = await transporter.sendMail({
  from: `ONE-SPACE <${user}>`,
  to: user,
  subject: "ONE-SPACE Gmail SMTP delivery test",
  text: "ONE-SPACE Gmail SMTP delivery test succeeded. This is a connectivity and delivery verification message, not an OTP. No account data was changed.",
  html: "<div style=\"font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden\"><div style=\"background:#0f172a;padding:24px;color:white\"><strong>ONE-SPACE</strong></div><div style=\"padding:24px\"><h2>Gmail SMTP delivery test</h2><p>Delivery succeeded. This message is not an OTP and no account data was changed.</p></div></div>",
});

console.log("GMAIL_SMTP_TEST_SENT=ok");
console.log(`GMAIL_SMTP_TEST_MESSAGE_ID_PRESENT=${Boolean(result.messageId)}`);
transporter.close();
