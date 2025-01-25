import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import Call from './models/Call';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-call-center')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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

// Handle incoming calls
app.post('/api/voice', (req, res) => {
  const twiml = new VoiceResponse();
  const fromNumber = req.body.From;
  const callSid = req.body.CallSid;

  // Store initial call data
  const call = new Call({
    callSid,
    timestamp: new Date(),
    phoneNumber: fromNumber,
    status: 'missed'
  });
  call.save();

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

  Call.findOne({ callSid }, (err, callData) => {
    if (err || !callData) {
      console.error('Error finding call data:', err);
      res.status(500).send(twiml.toString());
      return;
    }

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

    callData.save((err) => {
      if (err) {
        console.error('Error saving call data:', err);
      }
    });
  });

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
    'Vă rugăm să lăsați un mesaj după ton. Apăsați # când ați terminat.'
  );

  twiml.record({
    action: '/api/handle-recording',
    transcribe: true,
    transcribeCallback: '/api/handle-transcription',
    maxLength: 300,
    finishOnKey: '#',
    playBeep: true,
    timeout: 5
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handle recording completion
app.post('/api/handle-recording', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const recordingUrl = req.body.RecordingUrl;
  const duration = parseInt(req.body.RecordingDuration || '0');

  try {
    let call = await Call.findOne({ callSid });
    if (!call) {
      call = new Call({
        callSid,
        timestamp: new Date(),
        status: 'voicemail'
      });
    }
    
    call.recordingUrl = recordingUrl;
    call.duration = duration;
    await call.save();

    twiml.say(
      {
        language: 'ro-RO',
        voice: 'Polly.Carmen',
      },
      'Mulțumim pentru mesaj. O să vă contactăm în cel mai scurt timp.'
    );
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error saving recording:', error);
    res.status(500).send(twiml.toString());
  }
});

// Handle transcription completion
app.post('/api/handle-transcription', async (req, res) => {
  const callSid = req.body.CallSid;
  const transcriptionText = req.body.TranscriptionText;

  if (callSid && transcriptionText) {
    try {
      // Generate summary and analyze content
      const analysis = await analyzeCall(transcriptionText);

      let call = await Call.findOne({ callSid });
      if (!call) {
        call = new Call({
          callSid,
          timestamp: new Date(),
          status: 'voicemail'
        });
      }

      call.transcription = transcriptionText;
      call.summary = analysis.summary;
      call.category = analysis.category;
      call.priority = analysis.priority;
      call.followUpRequired = analysis.followUpRequired;
      await call.save();

      console.log('Call Analysis:', analysis);
      res.json({
        success: true,
        analysis,
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

// Get all calls with filtering
app.get('/api/calls', async (req, res) => {
  const { status, priority, category, startDate, endDate } = req.query;

  try {
    const query: any = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const calls = await Call.find(query).sort({ timestamp: -1 });
    res.json({ success: true, data: calls });
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch calls' });
  }
});

// Get single call
app.get('/api/calls/:callSid', async (req, res) => {
  try {
    const call = await Call.findOne({ callSid: req.params.callSid });
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found' });
    }
    res.json({ success: true, data: call });
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch call' });
  }
});

// Handle recording status
app.post('/api/recording-status', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;

  if (req.body.RecordingStatus === 'completed' && callSid) {
    // Store recording information
    console.log(`Recording completed: ${recordingUrl}`);

    try {
      let call = await Call.findOne({ callSid });
      if (!call) {
        call = new Call({
          callSid,
          timestamp: new Date(),
          status: 'answered', // Set an initial status for the recording
        });
      }
      
      call.recordingUrl = recordingUrl;
      await call.save();
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  }

  res.sendStatus(200);
});

// Handle outgoing calls
app.post('/api/call', express.json(), async (req: express.Request, res: express.Response) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      res.status(400).json({ success: false, error: 'Phone number is required' });
      return;
    }

    if (!twilioPhoneNumber) {
      res.status(500).json({ success: false, error: 'Twilio phone number not configured' });
      return;
    }

    const call = await client.calls.create({
      url: process.env.WEBHOOK_URL || 'https://demo.twilio.com/docs/voice.xml', // Fallback to Twilio demo TwiML
      to: to,
      from: twilioPhoneNumber
    });

    // Initialize call data
    const newCall = new Call({
      callSid: call.sid,
      timestamp: new Date(),
      status: 'answered',
      phoneNumber: to
    });
    await newCall.save();

    res.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error('Error making outbound call:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Call status webhook
app.post('/api/call-status', (req, res) => {
  console.log('Call Status:', req.body.CallStatus);
  res.sendStatus(200);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
