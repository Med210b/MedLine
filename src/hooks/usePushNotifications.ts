import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { IncomingCallKit } from '@capgo/capacitor-incoming-call-kit';

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'web' && user) {
      registerPush();
    }
  }, [user]);

  const registerPush = async () => {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      await supabase
        .from('users')
        .update({ fcm_token: token.value })
        .eq('id', user?.id);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Logic to trigger the native ringing screen
      if (notification.title?.includes('Call')) {
        IncomingCallKit.showIncomingCall({
          callId: Math.random().toString(), // The unique ID for the call
          callerName: notification.body || "Medline Caller", // FIX: Added 'callerName' (Required)
          handle: "Incoming Video Call", // Subtitle or number
          hasVideo: true,
        }).catch(err => console.error("Native CallKit error:", err));
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      navigate('/chat');
    });
  };
}