import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

// Google's Public STUN servers to bypass Wi-Fi and Firewalls
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
  const [filterIndex, setFilterIndex] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const unprocessedStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // FIX: Added a queue to hold ICE candidates that arrive before the call is answered
  const remoteIceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const FILTER_OPTIONS = [
    'none',
    'blur(2px) saturate(110%)',
    'grayscale(100%)',
    'sepia(100%)',
    'invert(100%)',
    'hue-rotate(90deg) saturate(130%)',
    'contrast(80%) saturate(80%)',
    'grayscale(100%) contrast(160%)',
  ];

  // SIGNALING SETUP
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('global_calls', {
      config: { broadcast: { ack: false } }
    });

    channel.on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
      if (payload.targetId !== user.id) return;

      if (payload.type === 'offer') {
        remoteIceCandidatesQueue.current = []; // Reset queue for new call
        setIncomingCall({ callerId: payload.senderId, offer: payload.data.offer, isVideo: payload.data.video });
      }

      if (payload.type === 'answer' && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.data));
        // Flush queue: add candidates that arrived while waiting for answer
        for (const candidate of remoteIceCandidatesQueue.current) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e: any){}
        }
        remoteIceCandidatesQueue.current = [];
      }

      if (payload.type === 'ice-candidate') {
        // If connection is ready, add it immediately. Otherwise, queue it!
        if (pcRef.current && pcRef.current.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.data));
          } catch (e: any) { console.error("Error adding received ice candidate", e); }
        } else {
          remoteIceCandidatesQueue.current.push(payload.data);
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

  // VIDEO FRAME PROCESSING LOOP
  useEffect(() => {
    const internalVideo = internalVideoRef.current;
    const canvas = canvasRef.current;
    if (!internalVideo || !canvas || !unprocessedStreamRef.current || !currentCall || !isVideo) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stream = unprocessedStreamRef.current;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    internalVideo.srcObject = stream;
    internalVideo.muted = true;
    internalVideo.play().catch(e => console.error("Error playing internal video:", e));

    const settings = videoTrack.getSettings();
    canvas.width = settings.width || 640;
    canvas.height = settings.height || 480;

    let animationFrameId: number;

    const processFrame = () => {
        if (!pcRef.current || !currentCall) {
            internalVideo.pause();
            internalVideo.srcObject = null;
            return;
        }
        
        ctx.filter = FILTER_OPTIONS[filterIndex];
        ctx.drawImage(internalVideo, 0, 0, canvas.width, canvas.height);
        animationFrameId = requestAnimationFrame(processFrame);
    };
    
    internalVideo.onloadedmetadata = () => {
        animationFrameId = requestAnimationFrame(processFrame);
    };

    return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        internalVideo.pause();
        internalVideo.srcObject = null;
    }
  }, [currentCall, filterIndex, isVideo]);

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
    if (unprocessedStreamRef.current) {
      unprocessedStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    unprocessedStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCurrentCall(null);
    setIncomingCall(null);
    setIsCaller(false);
    setIsVideo(false);
    setFilterIndex(0);
    remoteIceCandidatesQueue.current = [];
  };

  const initiateCall = async (targetId: string, video: boolean) => {
    setIsVideo(video);
    setIsCaller(true);
    setCurrentCall({ targetId, peerConnection: null });

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      unprocessedStreamRef.current = rawStream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setCurrentCall({ targetId, peerConnection: pc });

      let streamToSend = rawStream;
      
      if (video && canvasRef.current) {
        try {
          const canvasStream = (canvasRef.current as any).captureStream(30);
          const audioTrack = rawStream.getAudioTracks()[0];
          if (audioTrack) canvasStream.addTrack(audioTrack);
          streamToSend = canvasStream;
        } catch (e) {
          console.warn("Canvas capture stream failed on this device, using raw camera stream", e);
          streamToSend = rawStream;
        }
      }

      setLocalStream(streamToSend);
      
      streamToSend.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, streamToSend));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetId, 'ice-candidate', event.candidate);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(targetId, 'offer', { offer, video });

    } catch (err) {
      console.error("Failed to access Camera/Microphone:", err);
      alert("Call failed: Please ensure you have granted Camera and Microphone permissions.");
      cleanupCall();
    }
  };

  const answerCall = async () => {
    if (!incomingCall) return;
    setIsVideo(incomingCall.isVideo);
    setIsCaller(false);

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.isVideo, audio: true });
      unprocessedStreamRef.current = rawStream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      setCurrentCall({ targetId: incomingCall.callerId, peerConnection: pc });

      let streamToSend = rawStream;
      
      if (incomingCall.isVideo && canvasRef.current) {
        try {
          const canvasStream = (canvasRef.current as any).captureStream(30);
          const audioTrack = rawStream.getAudioTracks()[0];
          if (audioTrack) canvasStream.addTrack(audioTrack);
          streamToSend = canvasStream;
        } catch (e) {
          console.warn("Canvas capture stream failed, using raw stream", e);
          streamToSend = rawStream;
        }
      }

      setLocalStream(streamToSend);
      
      streamToSend.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, streamToSend));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal(incomingCall.callerId, 'ice-candidate', event.candidate);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      
      // FIX: Flush queue after setting remote description!
      for (const candidate of remoteIceCandidatesQueue.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e: any){}
      }
      remoteIceCandidatesQueue.current = [];

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

  const cycleFilter = () => {
    setFilterIndex((prev: number) => (prev + 1) % FILTER_OPTIONS.length);
  };

  return (
    <CallContext.Provider value={{
      initiateCall, incomingCall, currentCall, answerCall, rejectCall, endCall, 
      localStream, remoteStream, isVideo, isCaller, cycleFilter, filterIndex, FILTER_OPTIONS
    }}>
      {children}
      <canvas ref={canvasRef} className="absolute opacity-0 pointer-events-none w-2 h-2 -z-50" />
      <video ref={internalVideoRef} muted playsInline className="absolute opacity-0 pointer-events-none w-2 h-2 -z-50" />
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}