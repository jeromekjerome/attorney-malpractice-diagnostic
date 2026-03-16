import nodemailer from 'nodemailer';
import 'dotenv/config';

async function ping() {
    console.log('--- Email Connection Ping ---');
    console.log(`Connecting to ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} as ${process.env.SMTP_USER}...`);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const mailOptions = {
        from: `"AI Consultant Ping" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFICATION_EMAIL,
        subject: '🔔 AI Consultant: Connection Ping',
        text: 'This is a test notification to verify the connection between Siteground and Gmail is active.',
        html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                <h2 style="color: #dcb360;">🔔 Connection Ping Successful</h2>
                <p>The Siteground SMTP server at <strong>${process.env.SMTP_HOST}</strong> has successfully authenticated.</p>
                <p><strong>Sender:</strong> ${process.env.SMTP_USER}</p>
                <p><strong>Recipient:</strong> ${process.env.NOTIFICATION_EMAIL}</p>
                <p>This confirms the AI lead notification system is ready.</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Success! Message sent.');
        console.log('Message ID:', info.messageId);
        console.log('Recipient:', mailOptions.to);
    } catch (error) {
        console.error('❌ Ping failed:', error.message);
        if (error.code === 'EAUTH') {
            console.error('Authentication Error: Check your password in .env');
        } else if (error.code === 'ESOCKET') {
            console.error('Network Error: Could not connect to the mail server.');
        }
    }
}

ping();
