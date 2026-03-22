import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    // Only ask for permissions on a real phone, not the web browser
    if (Capacitor.getPlatform() !== 'web' && user) {
      registerPush();
    }
  }, [user]);

  const registerPush = async () => {
    // 1. Request permission from the user
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('User denied push notifications');
      return;
    }

    // 2. Register with Google Firebase
    await PushNotifications.register();

    // 3. Get the unique device token and save it to Supabase
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      
      const { error } = await supabase
        .from('users')
        .update({ fcm_token: token.value })
        .eq('id', user?.id);
        
      if (error) console.error("Error saving FCM token:", error);
    });

    // 4. Listen for errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // 5. Listen for incoming notifications while the app is OPEN
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', notification);
    });
  };
}