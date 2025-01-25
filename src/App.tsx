import React, { useState, useEffect } from 'react';
import {
  PhoneIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  UsersIcon,
  PlayIcon,
  PauseIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import TwilioSetup from './components/TwilioSetup';
import CallManager from './components/CallManager';
import CallList from './components/CallList';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStatus, setSystemStatus] = useState('active');
  const [twilioToken, setTwilioToken] = useState('');
  const [callStatus, setCallStatus] = useState('disconnected');
  const [twilioDevice, setTwilioDevice] = useState<any>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.token) {
          setTwilioToken(data.token);
        } else {
          throw new Error('No token in response');
        }
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    };

    fetchToken();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Call Controls</h2>
              <CallManager
                status={callStatus}
                onAnswer={() => setCallStatus('connected')}
                onHangup={() => setCallStatus('disconnected')}
              />
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-4">Recent Calls</h2>
              <CallList />
            </div>
          </div>
        );
      case 'calls':
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Call History</h2>
            <CallList />
          </div>
        );
      case 'settings':
        return <TwilioSetup token={twilioToken} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">AI Call Center</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('calls')}
                  className={`${
                    activeTab === 'calls'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Calls
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Settings
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setSystemStatus(systemStatus === 'active' ? 'paused' : 'active')}
                className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                  systemStatus === 'active'
                    ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                    : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                }`}
              >
                {systemStatus === 'active' ? (
                  <>
                    <PauseIcon className="h-5 w-5 mr-2" />
                    Pause System
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-5 w-5 mr-2" />
                    Activate System
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
