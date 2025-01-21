import React, { useState } from 'react';
import { PhoneIcon, XMarkIcon, PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';

interface CallManagerProps {
  status: string;
  onAnswer?: () => void;
  onHangup?: () => void;
  onTestCall?: () => void;
}

interface CallSummary {
  transcription: string;
  summary: string;
  recordingUrl?: string;
}

const CallManager: React.FC<CallManagerProps> = ({ status, onAnswer, onHangup, onTestCall }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callSummaries, setCallSummaries] = useState<Record<string, CallSummary>>({});
  const [currentCallSid, setCurrentCallSid] = useState<string | null>(null);

  const getStatusDisplay = () => {
    switch (status) {
      case 'incoming':
        return {
          text: 'Incoming Call',
          color: 'yellow',
          icon: PhoneArrowUpRightIcon
        };
      case 'connected':
        return {
          text: 'Connected',
          color: 'green',
          icon: PhoneIcon
        };
      case 'disconnected':
        return {
          text: 'Call Ended',
          color: 'gray',
          icon: XMarkIcon
        };
      default:
        return {
          text: 'Ready',
          color: 'blue',
          icon: PhoneIcon
        };
    }
  };

  const handleMakeCall = async () => {
    if (!phoneNumber) return;

    try {
      const response = await fetch('http://localhost:3000/api/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: phoneNumber }),
      });

      const data = await response.json();
      if (data.success) {
        setCurrentCallSid(data.callSid);
        if (onTestCall) onTestCall();
      }
    } catch (error) {
      console.error('Error making call:', error);
    }
  };

  const statusInfo = getStatusDisplay();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-6 h-6 text-${statusInfo.color}-500`} />
          <h3 className="text-lg font-semibold text-gray-800">{statusInfo.text}</h3>
        </div>
        <div className="flex gap-2">
          {status === 'disconnected' && (
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter phone number"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleMakeCall}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <PhoneIcon className="w-4 h-4" />
                Make Call
              </button>
            </div>
          )}
          {status === 'incoming' && onAnswer && (
            <button
              onClick={onAnswer}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <PhoneIcon className="w-4 h-4" />
              Answer
            </button>
          )}
          {status === 'connected' && onHangup && (
            <button
              onClick={onHangup}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Hang Up
            </button>
          )}
        </div>
      </div>

      {/* Call Summaries */}
      {Object.entries(callSummaries).length > 0 && (
        <div className="mt-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Recent Call Summaries</h4>
          <div className="space-y-4">
            {Object.entries(callSummaries).map(([callSid, summary]) => (
              <div key={callSid} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-medium text-gray-800">Call {callSid}</h5>
                  {summary.recordingUrl && (
                    <a
                      href={summary.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      Listen to Recording
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <strong>Summary:</strong> {summary.summary}
                  </p>
                  <details className="text-sm">
                    <summary className="text-blue-500 cursor-pointer">View Full Transcription</summary>
                    <p className="mt-2 text-gray-600">{summary.transcription}</p>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallManager;