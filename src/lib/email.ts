import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "caminoalaeropuerto@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.GMAIL_APP_PASSWORD) {
    return { success: false, error: "GMAIL_APP_PASSWORD not configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"ECH CRM" <${process.env.GMAIL_USER || "caminoalaeropuerto@gmail.com"}>`,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
