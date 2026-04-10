import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { initializeApp, cert } from 'npm:firebase-admin/app';
import { getMessaging } from 'npm:firebase-admin/messaging';

// Initialize Firebase using the secret service account key we will set later
const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
if (serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase initialization skipped or already running.");
  }
}

// FIX: Added ": Request" right here!
serve(async (req: Request) => {
  try {
    // 1. Grab the new message that was just inserted into your database
    const payload = await req.json();
    const messageRecord = payload.record;

    // 2. Connect to Supabase as an Admin to look up the user
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Admin key
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Figure out who is receiving the message! 
    // Your app joins IDs like "conv_userA_userB". We extract the ID that ISN'T the sender.
    const usersInConv = messageRecord.conversation_id.replace('conv_', '').split('_');
    const receiverId = usersInConv.find((id: string) => id !== messageRecord.sender_id);

    if (!receiverId) {
      throw new Error("Could not determine receiver ID from conversation_id");
    }

    // 4. Look up the receiver's phone token in the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', receiverId)
      .single();

    // If they aren't logged in on a phone or don't have a token, just exit quietly.
    if (userError || !userData?.fcm_token) {
      return new Response("User has no push token, skipping notification.", { status: 200 });
    }

    // 5. Build the notification based on if it's a call or a message
    const isCall = messageRecord.type === 'call';
    const notificationTitle = isCall ? "Incoming Call 📞" : "New Message";
    const notificationBody = isCall 
      ? "Someone is calling you on Medline" 
      : "You have received a new text message";

    // 6. Send the Push Notification via Firebase!
    const response = await getMessaging().send({
      token: userData.fcm_token,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        // This tells the phone to open the /chat page when tapped
        route: '/chat' 
      }
    });

    return new Response(JSON.stringify({ success: true, messageId: response }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Error sending push:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});