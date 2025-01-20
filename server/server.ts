import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const app = express();

// Configure CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Ensure required environment variables are present
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

if (!accountSid || !authToken || !apiKey || !apiSecret) {
  throw new Error('Missing required Twilio credentials in environment variables');
}

const twilioClient = twilio(accountSid, authToken);
const identity = process.env.TWILIO_IDENTITY?.replace(/['"]+/g, '') || 'default-identity';
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+17177885112';

// Root endpoint for testing
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Generate access token for Twilio Device
app.post('/api/token', (req, res) => {
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accessToken = new AccessToken(
    accountSid,
    apiKey,
    apiSecret,
    { identity }
  );

  const grant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);
  res.json({ token: accessToken.toJwt() });
});

// Make a call
app.post('/api/call', async (req, res) => {
  try {
    const { to } = req.body;
    const call = await twilioClient.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml', // You should replace this with your own TwiML
      to: to,
      from: twilioPhoneNumber,
    });
    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ success: false, error: 'Failed to make call' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
