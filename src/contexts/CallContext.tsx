import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

// We use Google's Public STUN servers to bypass Wi-Fi and 4G/5G Firewalls
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ]
};

const CallContext = createContext<any>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isCaller, setIsCaller] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);

  // Setup the Global WebRTC Signaling Channel using Supabase Broadcast
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global_calls', {
      config: { broadcast: { ack: false } }
    });

    channel.on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
      // Ignore signals not meant for us
      if (payload.targetId !== user.id) return;

      if (payload.type === 'offer') {
        setIncomingCall({ callerId: payload.senderId, offer: payload.data.offer, isVideo: payload.data.video });
      }

      if (payload.type === 'answer' && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.data));
      }

      if (payload.type === 'ice-candidate' && pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.data));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }

      if (payload.type === 'end-call' || payload.type === 'reject-call') {
        cleanupCall();
      }
    }).subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const sendSignal = (targetId: string, type: string, data: any) => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'call-signal',
        payload: { targetId, senderId: user.id, type, data }
      }).catch((err: any) => console.error("Signaling error:", err));
    }
  };

  const cleanupCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    // Stop camera and microphone to turn off the recording light
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
    setIsCaller(false);
    setIsVideo(false);
  };

  const initiateCall = async (targetId: string, video: boolean) => {
    setIsVideo(video);
    setIsCaller(true);
    setCurrentCall({ targetId, peerConnection: null });

    try {
      // 1. Get Camera/Mic Permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      setLocalStream(stream);

      // 2. Initialize WebRTC Connection with Google STUN Servers
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setCurrentCall({ targetId, peerConnection: pc });

      // 3. Add our camera/mic to the connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Listen for the other person's camera/mic
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 5. Generate Ice Candidates (Network pathways) and send them
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetId, 'ice-candidate', event.candidate);
        }
      };

      // 6. Create the Call Offer and send it
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(targetId, 'offer', { offer, video });

    } catch (err) {
      console.error("Failed to access Camera/Microphone:", err);
      alert("Call failed: Please ensure you have granted Camera and Microphone permissions in your browser.");
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    setIsVideo(incomingCall.isVideo);
    setIsCaller(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.isVideo, audio: true });
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setCurrentCall({ targetId: incomingCall.callerId, peerConnection: pc });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(incomingCall.callerId, 'ice-candidate', event.candidate);
        }
      };

      // Set the caller's offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // Create our answer and send it back
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(incomingCall.callerId, 'answer', answer);
      
      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to answer call:", err);
      alert("Could not answer: Please grant Camera/Microphone permissions.");
      rejectCall();
    }
  };

  const rejectCall = async () => {
    if (incomingCall && user) {
      sendSignal(incomingCall.callerId, 'reject-call', null);
      
      // Log missed call to database history
      const conversationId = `conv_${[user.id, incomingCall.callerId].sort().join('_')}`;
      await supabase.from('messages').insert([{
         conversation_id: conversationId,
         sender_id: incomingCall.callerId,
         content: JSON.stringify({ type: incomingCall.isVideo ? 'video' : 'voice', duration: 0 }),
         type: 'call',
         status: 'missed',
         timestamp: new Date().toISOString()
      }]);
    }
    cleanupCall();
  };

  const endCall = async () => {
    const targetId = currentCall?.targetId || incomingCall?.callerId;
    if (targetId && user) {
      sendSignal(targetId, 'end-call', null);
      
      // Log ended call to database history
      const conversationId = `conv_${[user.id, targetId].sort().join('_')}`;
      await supabase.from('messages').insert([{
         conversation_id: conversationId,
         sender_id: user.id,
         content: JSON.stringify({ type: isVideo ? 'video' : 'voice', duration: 0 }),
         type: 'call',
         status: 'ended',
         timestamp: new Date().toISOString()
      }]);
    }
    cleanupCall();
  };

  return (
    <CallContext.Provider value={{
      initiateCall,
      incomingCall,
      currentCall,
      answerCall,
      rejectCall,
      endCall,
      localStream,
      remoteStream,
      isVideo,
      isCaller
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}