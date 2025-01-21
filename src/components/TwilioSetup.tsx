import React, { useEffect, useState } from 'react';
import { Device } from '@twilio/voice-sdk';

interface TwilioSetupProps {
  token: string;
  onCallStatusChange: (status: string) => void;
  onDeviceReady: (device: any) => void;
}

const TwilioSetup: React.FC<TwilioSetupProps> = ({ token, onCallStatusChange, onDeviceReady }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeDevice = async () => {
      try {
        const newDevice = new Device(token, {
          codecPreferences: ['opus', 'pcmu'],
          fakeLocalDTMF: true,
          enableRingingState: true,
          disableAudioContextSounds: true, // Disable audio context sounds
          closeProtection: false, // Disable close protection
          appName: 'CallAICenter', // Custom app name
          appVersion: '1.0.0', // Custom version
          enableIceRestart: true, // Enable ICE restart for better connection handling
          maxAverageBitrate: 16000, // Set max bitrate to prevent quality issues
          disableIdTracking: true, // Disable ID tracking
        });

        await newDevice.register();
        setIsReady(true);
        onDeviceReady(newDevice);

        newDevice.on('incoming', () => {
          onCallStatusChange('incoming');
        });

        newDevice.on('connect', () => {
          onCallStatusChange('connected');
        });

        newDevice.on('disconnect', () => {
          onCallStatusChange('disconnected');
        });

      } catch (error) {
        console.error('Error initializing Twilio device:', error);
        onCallStatusChange('error');
      }
    };

    if (token) {
      initializeDevice();
    }
  }, [token, onCallStatusChange, onDeviceReady]);

  return (
    <div className="mb-4">
      <div className={`inline-flex items-center px-4 py-2 rounded-full ${
        isReady ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        <span className={`w-2 h-2 rounded-full mr-2 ${
          isReady ? 'bg-green-500' : 'bg-yellow-500'
        }`}></span>
        {isReady ? 'Twilio Connected' : 'Connecting to Twilio...'}
      </div>
    </div>
  );
};

export default TwilioSetup;