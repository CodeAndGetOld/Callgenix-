import React from 'react';
import { Phone, X, PhoneCall } from 'lucide-react';

interface CallManagerProps {
  status: string;
  onAnswer?: () => void;
  onHangup?: () => void;
  onTestCall?: () => void;
}

const CallManager: React.FC<CallManagerProps> = ({ status, onAnswer, onHangup, onTestCall }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'incoming':
        return {
          text: 'Incoming Call',
          color: 'yellow',
          icon: PhoneCall
        };
      case 'connected':
        return {
          text: 'Connected',
          color: 'green',
          icon: Phone
        };
      case 'disconnected':
        return {
          text: 'Call Ended',
          color: 'gray',
          icon: X
        };
      default:
        return {
          text: 'Ready',
          color: 'blue',
          icon: Phone
        };
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
            <button
              onClick={onTestCall}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Make Test Call
            </button>
          )}
          {status === 'incoming' && (
            <button
              onClick={onAnswer}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Answer
            </button>
          )}
          {status === 'connected' && (
            <button
              onClick={onHangup}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Hang Up
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallManager;