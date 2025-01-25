import React, { useState, useEffect } from 'react';
import {
  PhoneIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface Call {
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

const CallList: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
  });

  useEffect(() => {
    fetchCalls();
  }, [filters]);

  const fetchCalls = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.category) queryParams.append('category', filters.category);

      const response = await fetch(`/api/calls?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setCalls(
          data.calls.map((call: any) => ({
            ...call,
            timestamp: new Date(call.timestamp),
          })),
        );
      } else {
        setError('Failed to fetch calls');
      }
    } catch (error) {
      setError('Error fetching calls');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'missed':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case 'answered':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'voicemail':
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <PhoneIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-red-500 text-center p-4">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          className="border p-2 rounded"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="missed">Missed</option>
          <option value="answered">Answered</option>
          <option value="voicemail">Voicemail</option>
        </select>

        <select
          className="border p-2 rounded"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Call List */}
      <div className="grid grid-cols-1 gap-4">
        {calls.map((call) => (
          <div
            key={call.callSid}
            className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedCall(call)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {getStatusIcon(call.status)}
                <div>
                  <h3 className="font-semibold">{call.phoneNumber || 'Unknown'}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(call.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{formatDuration(call.duration)}</span>
              </div>
            </div>

            {call.summary && <p className="mt-2 text-gray-600">{call.summary}</p>}

            <div className="mt-2 flex gap-2">
              {call.priority && (
                <span className={`text-sm ${getPriorityColor(call.priority)}`}>
                  {call.priority.toUpperCase()}
                </span>
              )}
              {call.category && <span className="text-sm text-gray-500">{call.category}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Call Details</h2>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Phone Number</h3>
                <p>{selectedCall.phoneNumber || 'Unknown'}</p>
              </div>

              <div>
                <h3 className="font-semibold">Time</h3>
                <p>{new Date(selectedCall.timestamp).toLocaleString()}</p>
              </div>

              <div>
                <h3 className="font-semibold">Duration</h3>
                <p>{formatDuration(selectedCall.duration)}</p>
              </div>

              {selectedCall.transcription && (
                <div>
                  <h3 className="font-semibold">Transcription</h3>
                  <p className="whitespace-pre-wrap">{selectedCall.transcription}</p>
                </div>
              )}

              {selectedCall.summary && (
                <div>
                  <h3 className="font-semibold">Summary</h3>
                  <p>{selectedCall.summary}</p>
                </div>
              )}

              {selectedCall.recordingUrl && (
                <div>
                  <h3 className="font-semibold">Recording</h3>
                  <audio controls className="w-full mt-2">
                    <source src={selectedCall.recordingUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div className="flex gap-4">
                <div>
                  <h3 className="font-semibold">Status</h3>
                  <p className="capitalize">{selectedCall.status}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Priority</h3>
                  <p className={`capitalize ${getPriorityColor(selectedCall.priority)}`}>
                    {selectedCall.priority || 'None'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Category</h3>
                  <p className="capitalize">{selectedCall.category || 'None'}</p>
                </div>
              </div>

              {selectedCall.notes && (
                <div>
                  <h3 className="font-semibold">Notes</h3>
                  <p className="whitespace-pre-wrap">{selectedCall.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallList;
