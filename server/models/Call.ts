import mongoose, { Schema, Document } from 'mongoose';

export interface ICall extends Document {
  callSid: string;
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

const CallSchema: Schema = new Schema({
  callSid: { type: String, required: true, unique: true },
  transcription: { type: String },
  summary: { type: String },
  recordingUrl: { type: String },
  timestamp: { type: Date, required: true },
  phoneNumber: { type: String },
  duration: { type: Number },
  status: { 
    type: String, 
    required: true, 
    enum: ['missed', 'answered', 'voicemail'],
    default: 'missed'
  },
  category: { type: String },
  priority: { 
    type: String,
    enum: ['low', 'medium', 'high']
  },
  followUpRequired: { type: Boolean, default: false },
  notes: { type: String }
}, {
  timestamps: true
});

export default mongoose.model<ICall>('Call', CallSchema);
