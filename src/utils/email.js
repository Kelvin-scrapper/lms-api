// Sends through Resend when RESEND_API_KEY is set; otherwise logs the message,
// which is all local development needs (magic links appear in the API log).
async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.log('\n──────── EMAIL (dev, not sent) ────────');
    console.log('To:      ', to);
    console.log('Subject: ', subject);
    console.log(text);
    console.log('──────────────────────────────────────\n');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Summertech <login@summertech.ac.ke>',
      to,
      subject,
      text,
      html: html ?? `<p>${text.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  }
}

module.exports = { sendEmail };
