const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'whoprunner-secret-2026';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// In-memory store (use DB in production)
const users = {};
const verificationTokens = {};
const resetTokens = {};

// Email transporter — uses env vars for real sending, logs to console in dev
function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  // Dev mode: log emails to console
  return nodemailer.createTransport({
    jsonTransport: true
  });
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${BASE_URL}/verify?token=${token}`;
  const transporter = getTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@whoprunner.com',
    to: email,
    subject: 'Verify your WhopRunner account',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 40px; border-radius: 12px;">
        <h1 style="color: #6366f1; font-size: 28px; margin-bottom: 8px;">WhopRunner</h1>
        <h2 style="font-size: 20px; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #94a3b8; margin-bottom: 32px;">Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Verify Email</a>
        <p style="color: #475569; font-size: 12px; margin-top: 32px;">Link expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </div>
    `
  };

  const result = await transporter.sendMail(mailOptions);
  
  // In dev (jsonTransport), log the email
  if (!process.env.SMTP_HOST) {
    const parsed = JSON.parse(result.message);
    console.log('\n📧 [DEV EMAIL — Verification]');
    console.log(`To: ${email}`);
    console.log(`Verify URL: ${verifyUrl}\n`);
  }
  
  return verifyUrl;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (users[email]) {
    return res.status(409).json({ error: 'Account already exists with this email' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const verifyToken = crypto.randomBytes(32).toString('hex');

  users[email] = {
    id: `user-${Date.now()}`,
    email,
    name,
    password: hashedPassword,
    verified: false,
    plan: 'Starter',
    createdAt: new Date().toISOString()
  };

  verificationTokens[verifyToken] = {
    email,
    expires: Date.now() + 24 * 60 * 60 * 1000 // 24h
  };

  const verifyUrl = await sendVerificationEmail(email, verifyToken);

  res.status(201).json({
    message: 'Account created. Please check your email to verify.',
    // In dev mode, include the verify URL in the response for testing
    ...(process.env.NODE_ENV !== 'production' && { devVerifyUrl: verifyUrl })
  });
});

// GET /api/auth/verify?token=xxx
router.get('/verify', (req, res) => {
  const { token } = req.query;

  const record = verificationTokens[token];

  if (!record) {
    return res.status(400).json({ error: 'Invalid or expired verification link' });
  }

  if (Date.now() > record.expires) {
    delete verificationTokens[token];
    return res.status(400).json({ error: 'Verification link has expired. Please register again.' });
  }

  const user = users[record.email];
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  user.verified = true;
  delete verificationTokens[token];

  // Auto-login after verify
  const jwtToken = jwt.sign(
    { id: user.id, email: user.email, name: user.name, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  // Redirect to app with token in query (frontend reads it)
  res.redirect(`/?verified=true&token=${jwtToken}`);
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = users[email];
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.verified) {
    return res.status(403).json({ 
      error: 'Please verify your email before logging in.',
      needsVerification: true,
      email: user.email
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, plan: user.plan },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan
    }
  });
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  const user = users[email];

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email' });
  }

  if (user.verified) {
    return res.status(400).json({ error: 'Account is already verified' });
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');
  verificationTokens[verifyToken] = {
    email,
    expires: Date.now() + 24 * 60 * 60 * 1000
  };

  await sendVerificationEmail(email, verifyToken);
  res.json({ message: 'Verification email resent' });
});

// GET /api/auth/me — validate token + get user info
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users[decoded.email];
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
