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
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true,
  }),
);
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
  apiKey: process.env.OPENAI_API_KEY,
});

// Root endpoint for testing
app.get('/', (_req, res) => {
  res.send('Server is running');
});

// Generate Twilio token
app.post('/api/token', (_req, res) => {
  const accessToken = new AccessToken(accountSid!, apiKey!, apiSecret!, { identity });

  const grant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  accessToken.addGrant(grant);

  res.json({ token: accessToken.toJwt() });
});

// In-memory storage for call data
interface CallData {
  transcription?: string;
  summary?: string;
  recordingUrl?: string;
  timestamp: Date;
  phoneNumber?: string;
  duration?: number;
  status: 'missed' | 'answered' | 'voicemail';
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  followUpRequired?: boolean;
  notes?: string;
}

const callStorage = new Map<string, CallData>();

// Handle incoming calls
app.post('/api/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const fromNumber = req.body.From;
  const callSid = req.body.CallSid;

  // Store initial call data
  callStorage.set(callSid, {
    timestamp: new Date(),
    phoneNumber: fromNumber,
    status: 'missed',
  });

  // Start gathering input
  const gather = twiml.gather({
    input: ['speech', 'dtmf'],
    timeout: 3,
    numDigits: 1,
    action: '/api/handle-input',
    language: 'ro-RO',
  });

  gather.say(
    {
      language: 'ro-RO',
      voice: 'Polly.Carmen',
    },
    'Bună ziua! Ați sunat la serviciul de asistență. Apăsați 1 pentru urgențe, 2 pentru informații generale, sau așteptați să înregistrați un mesaj.',
  );

  // If no input received, proceed to voicemail
  twiml.redirect('/api/voicemail');

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle user input
app.post('/api/handle-input', (req, res) => {
  const twiml = new VoiceResponse();
  const digits = req.body.Digits;
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult;

  const callData = callStorage.get(callSid);
  if (callData) {
    if (digits === '1' || speechResult?.toLowerCase().includes('urgență')) {
      callData.priority = 'high';
      callData.category = 'emergency';

      twiml.say(
        {
          language: 'ro-RO',
          voice: 'Polly.Carmen',
        },
        'Vă vom redirecționa către serviciul de urgență. Vă rugăm să așteptați.',
      );

      // Forward to emergency number
      twiml.dial(process.env.EMERGENCY_PHONE_NUMBER || twilioPhoneNumber);
    } else if (digits === '2') {
      callData.priority = 'medium';
      callData.category = 'general';

      twiml.say(
        {
          language: 'ro-RO',
          voice: 'Polly.Carmen',
        },
        'Vă rugăm să lăsați un mesaj cu întrebarea dumneavoastră și vă vom contacta în cel mai scurt timp.',
      );

      twiml.redirect('/api/voicemail');
    } else {
      twiml.redirect('/api/voicemail');
    }

    callStorage.set(callSid, callData);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle voicemail
app.post('/api/voicemail', (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;

  twiml.say(
    {
      language: 'ro-RO',
      voice: 'Polly.Carmen',
    },
    'Vă rugăm să lăsați un mesaj după ton. Mesajul dumneavoastră va fi procesat și veți fi contactat în cel mai scurt timp.',
  );

  twiml.record({
    action: '/api/recording-status',
    transcribe: true,
    transcribeCallback: '/api/transcription',
    maxLength: 300,
    timeout: 5,
    playBeep: true,
  });

  const callData = callStorage.get(callSid);
  if (callData) {
    callData.status = 'voicemail';
    callStorage.set(callSid, callData);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Enhanced transcription handler
app.post('/api/transcription', async (req, res) => {
  const transcriptionText = req.body.TranscriptionText;
  const callSid = req.body.CallSid;

  if (transcriptionText && callSid) {
    try {
      // Generate summary and analyze content
      const analysis = await analyzeCall(transcriptionText);

      const callData = callStorage.get(callSid) || {
        timestamp: new Date(),
        status: 'voicemail',
      };

      callData.transcription = transcriptionText;
      callData.summary = analysis.summary;
      callData.category = analysis.category;
      callData.priority = analysis.priority;
      callData.followUpRequired = analysis.followUpRequired;
      callStorage.set(callSid, callData);

      console.log('Call Analysis:', analysis);
      res.json({
        success: true,
        analysis,
        callSid,
      });
    } catch (error) {
      console.error('Error in transcription handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      res.status(500).json({ success: false, error: errorMessage });
    }
  } else {
    res.status(400).json({
      success: false,
      error: !transcriptionText ? 'No transcription text provided' : 'No call SID provided',
    });
  }
});

// Analyze call content using OpenAI
async function analyzeCall(transcription: string): Promise<{
  summary: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  followUpRequired: boolean;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Ești un asistent specializat în analiza apelurilor pentru o instituție publică din România.
          Trebuie să:
          1. Creezi un rezumat concis al conversației
          2. Determini categoria apelului (ex: urgență medicală, reclamație, informații generale, etc.)
          3. Evaluezi prioritatea (low/medium/high) bazată pe urgența și importanța situației
          4. Determini dacă este necesară o urmărire ulterioară
          Răspunde în română, dar folosește valorile specificate pentru priority.`,
        },
        {
          role: 'user',
          content: `Analizează următoarea conversație telefonică: ${transcription}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content || '';

    // Parse the GPT response
    const lines = content.split('\n');
    let summary = '',
      category = '',
      priority: 'low' | 'medium' | 'high' = 'low';
    let followUpRequired = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('rezumat:')) {
        summary = line.split(':')[1].trim();
      } else if (line.toLowerCase().includes('categorie:')) {
        category = line.split(':')[1].trim();
      } else if (line.toLowerCase().includes('prioritate:')) {
        const priorityText = line.split(':')[1].trim().toLowerCase();
        priority = priorityText.includes('high')
          ? 'high'
          : priorityText.includes('medium')
          ? 'medium'
          : 'low';
      } else if (line.toLowerCase().includes('urmărire:')) {
        followUpRequired = line.split(':')[1].trim().toLowerCase().includes('da');
      }
    }

    return {
      summary,
      category,
      priority,
      followUpRequired,
    };
  } catch (error) {
    console.error('Error analyzing call:', error);
    throw new Error('Nu s-a putut analiza apelul');
  }
}

// Get all calls with filtering
app.get('/api/calls', (req, res) => {
  const { status, priority, category, startDate, endDate } = req.query;

  let filteredCalls = Array.from(callStorage.entries()).map(([callSid, data]) => ({
    callSid,
    ...data,
  }));

  // Apply filters
  if (status) {
    filteredCalls = filteredCalls.filter((call) => call.status === status);
  }
  if (priority) {
    filteredCalls = filteredCalls.filter((call) => call.priority === priority);
  }
  if (category) {
    filteredCalls = filteredCalls.filter((call) => call.category === category);
  }
  if (startDate) {
    const start = new Date(startDate as string);
    filteredCalls = filteredCalls.filter((call) => call.timestamp >= start);
  }
  if (endDate) {
    const end = new Date(endDate as string);
    filteredCalls = filteredCalls.filter((call) => call.timestamp <= end);
  }

  // Sort by timestamp descending
  filteredCalls.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  res.json({ success: true, calls: filteredCalls });
});

// Handle recording status
app.post('/api/recording-status', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;

  if (req.body.RecordingStatus === 'completed' && callSid) {
    // Store recording information
    console.log(`Recording completed: ${recordingUrl}`);

    const callData = callStorage.get(callSid) || {
      timestamp: new Date(),
    };

    callData.recordingUrl = recordingUrl;
    callStorage.set(callSid, callData);
  }

  res.sendStatus(200);
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

// Call status webhook
app.post('/api/call-status', (req, res) => {
  console.log('Call Status:', req.body.CallStatus);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
