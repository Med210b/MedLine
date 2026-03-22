import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeApp, cert } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

// 1. Authenticate with Firebase using your master key
const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
const serviceAccount = {
  projectId: Deno.env.get('FIREBASE_PROJECT_ID'),
  clientEmail: Deno.env.get('FIREBASE_CLIENT_EMAIL'),
  privateKey: privateKey,
};

initializeApp({ credential: cert(serviceAccount) });

serve(async (req) => {
  try {
    // 2. Read the new message that was just saved to the database
    const payload = await req.json();
    const message = payload.record;

    // We only care about new messages (INSERT)
    if (payload.type !== 'INSERT') return new Response("Not an insert", { status: 200 });
    
    // We only process 1-on-1 chats for now
    if (!message.conversation_id.startsWith('conv_')) {
         return new Response("Not a 1-on-1 chat", { status: 200 });
    }

    // 3. Figure out who the message is FOR (The receiver)
    const ids = message.conversation_id.replace('conv_', '').split('_');
    const receiverId = ids.find((id: string) => id !== message.sender_id);
    if (!receiverId) return new Response("No receiver found", { status: 200 });

    // 4. Connect back to Supabase to find the receiver's phone Token!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: receiver } = await supabase.from('users').select('fcm_token').eq('id', receiverId).single();
    const { data: sender } = await supabase.from('users').select('name').eq('id', message.sender_id).single();

    if (!receiver?.fcm_token) {
      return new Response("Receiver has no push token set up yet.", { status: 200 });
    }

    // 5. Format the text for the notification banner
    let bodyText = message.content;
    if (message.type === 'image') bodyText = '📷 Photo';
    if (message.type === 'audio') bodyText = '🎤 Voice message';
    if (message.type === 'document') bodyText = '📄 Document';
    if (message.type === 'call') bodyText = '📞 Call';

    // 6. FIRE THE NOTIFICATION!
    const response = await getMessaging().send({
      token: receiver.fcm_token,
      notification: {
        title: sender?.name || 'New Message',
        body: bodyText,
      },
      data: { conversation_id: message.conversation_id }
    });

    return new Response(JSON.stringify({ success: true, response }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});