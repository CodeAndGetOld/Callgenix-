import React, { useState, useEffect } from 'react';
import { Phone, MessageSquare, Settings, BarChart3, Users, Play, Pause, Bell } from 'lucide-react';
import TwilioSetup from './components/TwilioSetup';
import CallManager from './components/CallManager';

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
        console.error('Error fetching Twilio token:', error);
      }
    };

    fetchToken();
  }, []);

  const toggleStatus = () => {
    setSystemStatus(systemStatus === 'active' ? 'paused' : 'active');
  };

  const handleCallStatusChange = (status: string) => {
    setCallStatus(status);
  };

  const handleDeviceReady = (device: any) => {
    setTwilioDevice(device);
  };

  const handleTestCall = async () => {
    if (twilioDevice) {
      try {
        await twilioDevice.connect({
          params: {
            To: '+1234567890' // This will be handled by your TwiML
          }
        });
      } catch (error) {
        console.error('Error making test call:', error);
      }
    }
  };

  const handleHangup = () => {
    if (twilioDevice) {
      const activeConnection = twilioDevice.activeConnection();
      if (activeConnection) {
        activeConnection.disconnect();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed w-64 h-full bg-white border-r border-gray-200">
        <div className="flex items-center gap-2 p-6 border-b border-gray-200">
          <Phone className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">CallAI Center</h1>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {[
              { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
              { id: 'calls', icon: Phone, label: 'Active Calls' },
              { id: 'scripts', icon: MessageSquare, label: 'AI Scripts' },
              { id: 'agents', icon: Users, label: 'Virtual Agents' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center w-full gap-3 px-4 py-2 rounded-lg ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800">System Overview</h2>
          <button
            onClick={toggleStatus}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              systemStatus === 'active'
                ? 'bg-green-50 text-green-600'
                : 'bg-yellow-50 text-yellow-600'
            }`}
          >
            {systemStatus === 'active' ? (
              <>
                <Play className="w-5 h-5" />
                System Active
              </>
            ) : (
              <>
                <Pause className="w-5 h-5" />
                System Paused
              </>
            )}
          </button>
        </div>

        {/* Twilio Setup and Call Manager */}
        {twilioToken && (
          <>
            <TwilioSetup 
              token={twilioToken} 
              onCallStatusChange={handleCallStatusChange}
              onDeviceReady={handleDeviceReady}
            />
            <CallManager 
              status={callStatus}
              onTestCall={handleTestCall}
              onHangup={handleHangup}
            />
          </>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Active Calls', value: '12', color: 'blue' },
            { label: 'Avg. Call Duration', value: '4m 32s', color: 'green' },
            { label: 'Queue Length', value: '3', color: 'yellow' },
            { label: 'Resolution Rate', value: '94%', color: 'purple' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
            >
              <p className="text-gray-600 text-sm">{stat.label}</p>
              <p className={`text-2xl font-bold mt-2 text-${stat.color}-600`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Alerts</h3>
          <div className="space-y-4">
            {[
              { message: 'High call volume detected', time: '2 minutes ago', type: 'warning' },
              { message: 'New AI script deployed successfully', time: '1 hour ago', type: 'success' },
              { message: 'System maintenance scheduled', time: '3 hours ago', type: 'info' },
            ].map((alert, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
              >
                <Bell className={`w-5 h-5 text-${
                  alert.type === 'warning' ? 'yellow' : 
                  alert.type === 'success' ? 'green' : 'blue'
                }-500`} />
                <div>
                  <p className="text-gray-800">{alert.message}</p>
                  <p className="text-sm text-gray-500">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;