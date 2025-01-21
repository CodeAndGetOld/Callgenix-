import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const identity = process.env.TWILIO_IDENTITY || 'user';

const client = twilio(accountSid, authToken);
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const { VoiceResponse } = twilio.twiml;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Root endpoint for testing
app.get('/', (_req, res) => {
  res.send('Server is running');
});

// Generate Twilio token
app.post('/api/token', (_req, res) => {
  const accessToken = new AccessToken(
    accountSid!,
    apiKey!,
    apiSecret!,
    { identity }
  );

  const grant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);

  res.json({ token: accessToken.toJwt() });
});

// Handle incoming calls
app.post('/api/voice', (req, res) => {
  const twiml = new VoiceResponse();

  twiml.start().stream({
    name: 'Audio Stream',
    url: 'wss://' + req.headers.host + '/media'
  });

  // Record the call
  twiml.record({
    action: '/api/recording-status',
    recordingStatusCallback: '/api/recording-status',
    recordingStatusCallbackEvent: ['completed'],
    transcribe: true,
    transcribeCallback: '/api/transcription'
  });

  // Connect the call
  twiml.dial({
    callerId: twilioPhoneNumber
  }, req.body.To);

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle outbound calls
app.post('/api/call', async (req, res) => {
  try {
    const call = await client.calls.create({
      url: `https://${req.headers.host}/api/voice`,
      to: req.body.to,
      from: twilioPhoneNumber!,
      record: true,
      recordingStatusCallback: '/api/recording-status',
      recordingStatusCallbackEvent: ['completed'],
      statusCallback: '/api/call-status',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error making call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// In-memory storage for call data
interface CallData {
  transcription?: string;
  summary?: string;
  recordingUrl?: string;
  timestamp: Date;
}

const callStorage = new Map<string, CallData>();

// Handle recording status
app.post('/api/recording-status', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;

  if (req.body.RecordingStatus === 'completed' && callSid) {
    // Store recording information
    console.log(`Recording completed: ${recordingUrl}`);
    
    const callData = callStorage.get(callSid) || {
      timestamp: new Date()
    };
    
    callData.recordingUrl = recordingUrl;
    callStorage.set(callSid, callData);
  }

  res.sendStatus(200);
});

// Handle transcription
app.post('/api/transcription', async (req, res) => {
  const transcriptionText = req.body.TranscriptionText;
  const callSid = req.body.CallSid;

  if (transcriptionText && callSid) {
    try {
      // Generate summary using OpenAI
      const summary = await generateSummary(transcriptionText);
      
      // Store the data
      const callData = callStorage.get(callSid) || {
        timestamp: new Date()
      };
      
      callData.transcription = transcriptionText;
      callData.summary = summary;
      callStorage.set(callSid, callData);
      
      console.log('Call Summary:', summary);
      res.json({ 
        success: true, 
        summary,
        transcription: transcriptionText,
        language: 'ro-RO',
        callSid
      });
    } catch (error) {
      console.error('Error in transcription handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ success: false, error: errorMessage });
    }
  } else {
    res.status(400).json({ 
      success: false, 
      error: !transcriptionText ? 'No transcription text provided' : 'No call SID provided' 
    });
  }
});

// Get call data
app.get('/api/calls/:callSid', (req, res) => {
  const { callSid } = req.params;
  const callData = callStorage.get(callSid);
  
  if (callData) {
    res.json({ success: true, data: callData });
  } else {
    res.status(404).json({ success: false, error: 'Call data not found' });
  }
});

// Get all calls
app.get('/api/calls', (_req, res) => {
  const calls = Array.from(callStorage.entries()).map(([callSid, data]) => ({
    callSid,
    ...data
  }));
  
  res.json({ success: true, calls });
});

// Generate summary using OpenAI
async function generateSummary(transcription: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Ești un asistent care creează rezumate concise ale conversațiilor telefonice în limba română. Concentrează-te pe punctele cheie, acțiunile necesare și detaliile importante."
        },
        {
          role: "user",
          content: `Te rog să rezumi această conversație telefonică în limba română: ${transcription}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || 'Nu s-a putut genera un rezumat';
  } catch (error) {
    console.error('Error generating summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Nu s-a putut genera rezumatul: ${errorMessage}`);
  }
}

// Call status webhook
app.post('/api/call-status', (req, res) => {
  console.log('Call Status:', req.body.CallStatus);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
