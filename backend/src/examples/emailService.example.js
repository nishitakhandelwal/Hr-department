import { sendEmail } from "../services/emailService.js";

const run = async () => {
  const result = await sendEmail({
    to: "recipient@example.com",
    subject: "Brevo Email Service Test",
    html: "<h1>Hello from Brevo</h1><p>This is a production-ready test email.</p>",
  });

  console.log(result);
};

run().catch((error) => {
  console.error("[emailService.example] Failed to send email", error);
  process.exit(1);
});
