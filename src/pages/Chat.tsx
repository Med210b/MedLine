import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useCall } from '@/src/contexts/CallContext';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Phone, Video, Send, Image as ImageIcon, Paperclip, LogOut, User as UserIcon, Check, CheckCheck, Mic, MicOff, VideoOff, Settings, Search, Reply, X, MessageSquarePlus, Lock, Laptop, Smartphone, ArrowLeft, Camera, Bell, Moon, ChevronRight, Circle, CheckCircle2, Archive, Pin, MoreVertical, Smile, FileText, StopCircle, Wand2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { playNotificationSound, showNotification } from '@/src/hooks/useNotifications';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import EmojiPicker, { Theme } from 'emoji-picker-react';

import customRingtone from '@/src/assets/Ringtone.mp3';

const APP_LOGO = 'https://i.postimg.cc/hGWD8Fx8/wkx78803bxrmt0cx25brw9e388-result-0.jpg';
const CUSTOM_RINGTONE = customRingtone;

const formatChatTime = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
};

type SidebarView = 'chats' | 'calls' | 'settings' | 'profile' | 'privacy' | 'privacy-last-seen' | 'privacy-profile-photo' | 'theme' | 'notifications' | 'archived';

const FILTER_OPTIONS = [
  'none',
  'grayscale(100%)',
  'sepia(100%)',
  'invert(100%)',
  'hue-rotate(90deg)',
  'hue-rotate(180deg)',
  'contrast(150%) saturate(120%)'
];

export default function Chat() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { initiateCall, incomingCall, currentCall, answerCall, rejectCall, endCall, localStream, remoteStream, isVideo, isCaller, cycleFilter, filterIndex, FILTER_OPTIONS: contextFilters } = useCall();
  
  const [sidebarView, setSidebarView] = useState<SidebarView>('chats');
  const [activeTab, setActiveTab] = useState<'chats' | 'calls'>('chats');
  const [loading, setLoading] = useState(true);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const [myProfile, setMyProfile] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [privacyLastSeen, setPrivacyLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [privacyOnline, setPrivacyOnline] = useState<'everyone' | 'same_as_last_seen'>('everyone');
  const [privacyProfilePhoto, setPrivacyProfilePhoto] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(localStorage.getItem('whatsapp_theme') as any || 'system');
  const [soundsEnabled, setSoundsEnabled] = useState(localStorage.getItem('whatsapp_sounds') !== 'false');
  
  const [archivedChats, setArchivedChats] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_archived') || '[]'));
  const [pinnedChats, setPinnedChats] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_pinned') || '[]'));
  const [manualUnread, setManualUnread] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_unread') || '[]'));
  const [blockedUsers, setBlockedUsers] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_blocked') || '[]'));
  
  const [contextMenu, setContextMenu] = useState<{ show: boolean, x: number, y: number, chat: any, convId: string } | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{ show: boolean, x: number, y: number, msg: any } | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [chatMeta, setChatMeta] = useState<Record<string, { lastMessage: any, unreadCount: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchPhone, setSearchPhone] = useState<string | undefined>('');
  const [searchError, setSearchError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const usersRef = useRef<any[]>([]);
  const chatMetaRef = useRef<any>({});
  const activeConversationRef = useRef<any>(null);
  const blockedUsersRef = useRef<string[]>([]);
  
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { chatMetaRef.current = chatMeta; }, [chatMeta]);
  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { blockedUsersRef.current = blockedUsers; }, [blockedUsers]);

  const incomingAudioRef = useRef<HTMLAudioElement>(null);
  const outgoingAudioRef = useRef<HTMLAudioElement>(null);

  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    if (incomingCall && !currentCall) {
      incomingAudioRef.current?.play().catch(e => console.warn("Autoplay blocked."));
    } else {
      if (incomingAudioRef.current) {
        incomingAudioRef.current.pause();
        incomingAudioRef.current.currentTime = 0;
      }
    }

    if (currentCall && !remoteStream && isCaller) {
      outgoingAudioRef.current?.play().catch(e => console.warn("Autoplay blocked."));
    } else {
      if (outgoingAudioRef.current) {
        outgoingAudioRef.current.pause();
        outgoingAudioRef.current.currentTime = 0;
      }
    }
  }, [incomingCall, currentCall, remoteStream, isCaller]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  const playReceiveSound = () => {
    if (!soundsEnabled) return;
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch(e => console.warn("Browser blocked receive sound", e));
  };

  const playSendSound = () => {
    if (!soundsEnabled) return;
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.play().catch(e => console.warn("Browser blocked send sound", e));
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      setTimeout(() => remoteVideoRef.current?.play().catch(e => console.error("Remote play error:", e)), 100);
    }
  }, [localStream, remoteStream, currentCall]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) interval = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    else setRecordingTime(0);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentCall && remoteStream) {
      interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else if (!currentCall) {
      setCallDuration(0);
      setIsMuted(false);
      setIsVideoOff(false);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [currentCall, remoteStream]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('whatsapp_theme', theme);
  }, [theme]);

  useEffect(() => { 
    localStorage.setItem('whatsapp_archived', JSON.stringify(archivedChats)); 
    localStorage.setItem('whatsapp_pinned', JSON.stringify(pinnedChats)); 
    localStorage.setItem('whatsapp_unread', JSON.stringify(manualUnread)); 
    localStorage.setItem('whatsapp_blocked', JSON.stringify(blockedUsers));
    localStorage.setItem('whatsapp_sounds', soundsEnabled.toString());
  }, [archivedChats, pinnedChats, manualUnread, blockedUsers, soundsEnabled]);

  useEffect(() => {
    const handleClick = () => { setContextMenu(null); setMessageContextMenu(null); setShowHeaderMenu(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchMyProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) { setMyProfile(data); setEditName(data.name || ''); } else navigate('/profile');
    };
    fetchMyProfile();

    const setOnlineStatus = async (status: boolean) => {
       if (privacyOnline !== 'everyone') return; 
       await supabase.from('users').update({ is_online: status, last_seen: new Date().toISOString() }).eq('id', user.id);
    };
    setOnlineStatus(true);
    
    const handleVisibilityChange = () => setOnlineStatus(document.visibilityState === 'visible');
    const handleBeforeUnload = () => setOnlineStatus(false);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOnlineStatus(false);
    };
  }, [user, privacyOnline]);

  useEffect(() => {
    if (!user) return;
    
    fetchAllChatMetadata();
    fetchConversations();
    fetchCallHistory();

    const messageSubscription = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new;
        if (blockedUsersRef.current.includes(newMsg.sender_id)) return; 

        const currentActiveChat = activeConversationRef.current;
        
        if (newMsg.type !== 'reaction') {
          setChatMeta(prev => {
            const isMyMsg = newMsg.sender_id === user?.id;
            const isActiveChat = currentActiveChat?.id === newMsg.conversation_id;
            const currentCount = prev[newMsg.conversation_id]?.unreadCount || 0;
            return {
              ...prev,
              [newMsg.conversation_id]: { lastMessage: newMsg, unreadCount: (!isMyMsg && !isActiveChat) ? currentCount + 1 : currentCount }
            };
          });
        }

        if (newMsg.conversation_id === currentActiveChat?.id) {
          setMessages(prev => {
             if (prev.some(m => m.id === newMsg.id)) return prev.map(m => m.id === newMsg.id ? newMsg : m);
             const tempIndex = prev.findIndex(m => m.id.toString().startsWith('temp-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content);
             if (tempIndex !== -1) {
               const newArr = [...prev];
               newArr[tempIndex] = newMsg;
               return newArr;
             }
             return [...prev, newMsg];
          });
          if (newMsg.type !== 'reaction') scrollToBottom();
          if (newMsg.sender_id !== user?.id && newMsg.type !== 'reaction') {
            supabase.from('messages').update({ status: document.visibilityState === 'visible' ? 'read' : 'delivered' }).eq('id', newMsg.id).then();
          }
        } else if (newMsg.sender_id !== user?.id && newMsg.type !== 'reaction') {
          playReceiveSound();
          if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted' && soundsEnabled) {
             const senderUser = usersRef.current.find(u => u.id === newMsg.sender_id);
             new Notification(senderUser?.name || "MedLine EST", { 
               body: newMsg.type === 'text' ? newMsg.content : (newMsg.type === 'audio' ? '🎤 Voice message' : '📎 Attachment'),
               icon: senderUser?.avatar_url || APP_LOGO
             });
          }
          supabase.from('messages').update({ status: 'delivered' }).eq('id', newMsg.id).then();
        }

        if (newMsg.conversation_id.startsWith('conv_') && newMsg.conversation_id.includes(user?.id)) {
           const otherId = newMsg.conversation_id.replace('conv_', '').split('_').find((id: string) => id !== user?.id);
           if (otherId && !usersRef.current.find(u => u.id === otherId)) {
             supabase.from('users').select('*').eq('id', otherId).single().then(({data}) => {
               if (data) setUsers(prev => {
                 if (prev.find(u => u.id === data.id)) return prev;
                 return [...prev, data];
               });
             });
           }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const currentActiveChat = activeConversationRef.current;
        if (payload.new.conversation_id === currentActiveChat?.id) {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
        if (payload.new.type !== 'reaction') {
          setChatMeta(prev => {
             if (prev[payload.new.conversation_id]?.lastMessage?.id === payload.new.id) {
                 return { ...prev, [payload.new.conversation_id]: { ...prev[payload.new.conversation_id], lastMessage: payload.new } };
             }
             return prev;
          });
        }
      })
      .subscribe();

    const userSubscription = supabase.channel('public:users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
        if (payload.new.id === user.id) {
          setMyProfile(payload.new);
        } else {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
          setActiveConversation(prev => prev?.user?.id === payload.new.id ? { ...prev, user: { ...prev.user, ...payload.new } } : prev);
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
      supabase.removeChannel(userSubscription);
    };
  }, [user?.id, soundsEnabled]); 

  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    observer.current = new IntersectionObserver((entries) => {
        if (document.visibilityState !== 'visible') return;
        const visibleUnreadIds: string[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            const senderId = entry.target.getAttribute('data-sender-id');
            const status = entry.target.getAttribute('data-status');
            const type = entry.target.getAttribute('data-type');
            if (messageId && senderId !== user?.id && status !== 'read' && type !== 'reaction') {
              visibleUnreadIds.push(messageId);
              observer.current?.unobserve(entry.target);
            }
          }
        });
        if (visibleUnreadIds.length > 0) {
          supabase.from('messages').update({ status: 'read' }).in('id', visibleUnreadIds).then();
        }
      }, { threshold: 0.1 });
    return () => observer.current?.disconnect();
  }, [user?.id]);

  const fetchAllChatMetadata = async () => {
    if (!user) return;
    const { data: allUserMsgs, error } = await supabase.from('messages').select('*').ilike('conversation_id', `%${user.id}%`).order('timestamp', { ascending: true });
    if (error) console.error("Error fetching chats:", error);
    
    if (allUserMsgs) {
      const meta: Record<string, { lastMessage: any, unreadCount: number }> = {};
      const uniqueUserIds = new Set<string>();

      allUserMsgs.forEach(m => {
        if (m.type === 'reaction') return; 
        if (!meta[m.conversation_id]) meta[m.conversation_id] = { lastMessage: m, unreadCount: 0 };
        meta[m.conversation_id].lastMessage = m;
        if (m.sender_id !== user.id && m.status !== 'read') {
          meta[m.conversation_id].unreadCount += 1;
        }
        if (m.conversation_id.startsWith('conv_')) {
          const otherId = m.conversation_id.replace('conv_', '').split('_').find((id: string) => id !== user.id);
          if (otherId) uniqueUserIds.add(otherId);
        }
      });
      setChatMeta(meta);

      if (uniqueUserIds.size > 0) {
        const { data: chatUsers } = await supabase.from('users').select('*').in('id', Array.from(uniqueUserIds));
        if (chatUsers) setUsers(chatUsers);
      }
    }
  };

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('*').eq('type', 'group_created').ilike('content', `%${user.id}%`);
    if (data) {
      setConversations(data.map(msg => {
        try { return { id: msg.conversation_id, name: JSON.parse(msg.content).name, participants: JSON.parse(msg.content).participants, isGroup: true }; } catch (e) { return null; }
      }).filter(Boolean));
    }
    setLoading(false);
  };

  const fetchCallHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('*').eq('type', 'call').ilike('conversation_id', `%${user.id}%`).order('timestamp', { ascending: false });
    if (data) setCallHistory(data);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('timestamp', { ascending: true });
    if (error) console.error("Fetch Messages Error:", error);
    if (data) {
      setMessages(data);
      const unreadIds = data.filter(m => m.sender_id !== user?.id && m.status !== 'read' && m.type !== 'reaction').map(m => m.id);
      if (unreadIds.length > 0) supabase.from('messages').update({ status: 'read' }).in('id', unreadIds).then();
    }
    scrollToBottom();
  };

  const startConversation = async (otherUser: any) => {
    const conversationId = `conv_${[user?.id, otherUser.id].sort().join('_')}`;
    setActiveConversation({ id: conversationId, user: otherUser });
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowContactInfo(false);
    setChatMeta(prev => ({ ...prev, [conversationId]: { ...prev[conversationId], unreadCount: 0 } }));
    setManualUnread(prev => prev.filter(id => id !== conversationId)); 
    fetchMessages(conversationId);
  };

  const startGroupConversation = async (group: any) => {
    setActiveConversation({ id: group.id, isGroup: true, name: group.name, participants: group.participants });
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowContactInfo(false);
    setChatMeta(prev => ({ ...prev, [group.id]: { ...prev[group.id], unreadCount: 0 } }));
    setManualUnread(prev => prev.filter(id => id !== group.id));
    fetchMessages(group.id);
  };

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    if (!searchPhone || !user) return;
    
    const cleanPhone = searchPhone.replace(/\s+/g, '');
    const { data, error } = await supabase.from('users').select('*').eq('phone', cleanPhone).neq('id', user.id).limit(1);
    
    if (error) { alert(`Database Search Error: ${error.message}`); return; }
    if (!data || data.length === 0) { setSearchError('No MedLine user found with this phone number.'); return; }
    
    const contact = data[0];
    setUsers(prev => prev.find(u => u.id === contact.id) ? prev : [...prev, contact]);
    setShowNewChat(false);
    setSearchPhone('');
    setSidebarView('chats');
    setActiveTab('chats');
    startConversation(contact); 
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!activeConversation || !channelRef.current) return;
    if (channelRef.current.state !== 'joined') return;
    if (!isTyping) {
      setIsTyping(true);
      channelRef.current.send({ type: 'broadcast', event: 'typing_start', payload: { user_id: user?.id } }).catch(() => {});
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (channelRef.current?.state === 'joined') {
        channelRef.current.send({ type: 'broadcast', event: 'typing_stop', payload: { user_id: user?.id } }).catch(() => {});
      }
    }, 2000);
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !user) return;

    let msgContent = newMessage;
    let msgType = 'text';

    if (replyingTo) {
      msgType = 'reply';
      let originalText = replyingTo.content;
      if (replyingTo.type === 'image') originalText = '📷 Photo';
      if (replyingTo.type === 'audio') originalText = '🎤 Voice message';
      if (replyingTo.type === 'document') originalText = '📄 Document';
      if (replyingTo.type === 'call') originalText = '📞 Call';
      const senderInfo = users.find(u => u.id === replyingTo.sender_id);
      msgContent = JSON.stringify({
        text: newMessage,
        originalId: replyingTo.id,
        originalText: originalText,
        originalSender: replyingTo.sender_id === user.id ? 'You' : (senderInfo?.name || 'Someone')
      });
    }

    const tempId = `temp-${Date.now()}`;
    const newMsgObj = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: msgContent,
      type: msgType,
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    setNewMessage('');
    setShowEmojiPicker(false);
    setReplyingTo(null);
    setMessages(prev => [...prev, newMsgObj]);
    playSendSound(); 
    
    setChatMeta(prev => ({
      ...prev,
      [activeConversation.id]: {
         lastMessage: newMsgObj,
         unreadCount: prev[activeConversation.id]?.unreadCount || 0
      }
    }));
    scrollToBottom();
    
    if (isTyping && channelRef.current && channelRef.current.state === 'joined') {
      setIsTyping(false);
      clearTimeout(typingTimeoutRef.current!);
      channelRef.current.send({ type: 'broadcast', event: 'typing_stop', payload: { user_id: user.id } }).catch(() => {});
    }

    const { error } = await supabase.from('messages').insert([{
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: msgContent,
      type: msgType,
      status: 'sent',
      timestamp: newMsgObj.timestamp
    }]);

    if (error) alert(`Failed to send message!\nError: ${error.message}`);
  };

  const sendReaction = async (msgId: string, emoji: string) => {
    setMessageContextMenu(null);
    if (!activeConversation || !user) return;
    
    const reactionContent = JSON.stringify({ targetId: msgId, emoji });
    const tempId = `react-${Date.now()}`;
    
    const newReactionObj = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: reactionContent,
      type: 'reaction',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newReactionObj]);
    
    await supabase.from('messages').insert([{
      conversation_id: activeConversation.id,
      sender_id: user.id,
      content: reactionContent,
      type: 'reaction',
      status: 'sent',
      timestamp: newReactionObj.timestamp
    }]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `${user?.id}-audio-${Date.now()}.webm`;
        
        try {
          const { error: uploadError } = await supabase.storage.from('chat-media').upload(fileName, audioBlob);
          if (uploadError) throw uploadError;
          
          const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
          
          await supabase.from('messages').insert([{
            conversation_id: activeConversation.id,
            sender_id: user?.id,
            content: data.publicUrl,
            type: 'audio',
            status: 'sent',
            timestamp: new Date().toISOString()
          }]);
          playSendSound();
        } catch (err: any) {
          console.error('Error uploading audio', err);
          alert(`Failed to send audio: ${err.message}`);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing mic:", err);
      alert("Please allow microphone access to send voice messages.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeConversation) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
    const isImage = file.type.startsWith('image/');
    
    try {
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      
      const msgContent = isImage ? data.publicUrl : JSON.stringify({ url: data.publicUrl, name: file.name });
      const msgType = isImage ? 'image' : 'document';

      const { error } = await supabase.from('messages').insert([{
        conversation_id: activeConversation.id,
        sender_id: user?.id,
        content: msgContent,
        type: msgType,
        status: 'sent',
        timestamp: new Date().toISOString() 
      }]);
      
      if (!error) playSendSound();
      else alert(`Failed to send file: ${error.message}`);
    } catch (err: any) { 
      console.error('Error uploading file', err); 
      alert(`File upload failed: ${err.message}`);
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedUsers.length === 0 || !user) return;
    const groupId = `group-${crypto.randomUUID()}`;
    const participants = [user.id, ...selectedUsers];
    const msg = {
      conversation_id: groupId,
      sender_id: user.id,
      content: JSON.stringify({ name: newGroupName.trim(), participants }),
      type: 'group_created',
      status: 'sent',
      timestamp: new Date().toISOString()
    };
    const { error } = await supabase.from('messages').insert([msg]);
    if (error) { alert(`Failed to create group: ${error.message}`); return; }
    setShowCreateGroup(false);
    setNewGroupName('');
    setSelectedUsers([]);
    const newGroup = { id: groupId, name: newGroupName.trim(), participants, isGroup: true };
    setConversations(prev => [...prev, newGroup]);
    startGroupConversation(newGroup);
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id);
        setMyProfile((prev: any) => ({ ...prev, avatar_url: data.publicUrl }));
      }
    } catch (err) { console.error(err); }
  };

  const saveProfileName = async () => {
    if (!user || !editName.trim()) return;
    await supabase.from('users').update({ name: editName.trim() }).eq('id', user.id);
    setMyProfile((prev: any) => ({ ...prev, name: editName.trim() }));
  };

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const getCallDescription = (msg: any) => {
    let callData;
    try {
        callData = JSON.parse(msg.content);
    } catch (e) {
        return 'Call';
    }
    const icon = callData.type === 'video' ? '📷' : '📞';
    const typeText = callData.type === 'video' ? 'Video call' : 'Voice call';
    
    let statusText = '';
    if (msg.status === 'missed') statusText = '(missed)';
    else if (msg.status === 'ended') statusText = '(ended)';
    else statusText = '(declined)';

    return `${icon} ${typeText} ${statusText}`;
  }

  const renderLastMessagePreview = (msg: any) => {
    if (!msg) return '';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'audio') return '🎤 Voice message';
    if (msg.type === 'document') return '📄 Document';
    if (msg.type === 'call') return getCallDescription(msg);
    if (msg.type === 'reply') {
      try { return JSON.parse(msg.content).text; } catch(e) { return 'Message'; }
    }
    return msg.content;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStream) {
      const newMutedState = !isMuted;
      localStream.getAudioTracks().forEach(track => { track.enabled = !newMutedState; });
      setIsMuted(newMutedState);
    }
  };

  const toggleVideo = async () => {
    if (!localStream || !currentCall) return;
    if (!isVideoOff) {
      localStream.getVideoTracks().forEach(track => { track.stop(); localStream.removeTrack(track); });
      setIsVideoOff(true);
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStream.addTrack(newVideoTrack);
        const sender = currentCall.peerConnection?.getSenders().find((s: any) => s.track?.kind === 'video' || s.track === null);
        if (sender) sender.replaceTrack(newVideoTrack);
        else if (currentCall.peerConnection) currentCall.peerConnection.addTrack(newVideoTrack, localStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        setIsVideoOff(false);
      } catch (err) { console.error('Failed to restart camera', err); }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chat: any, convId: string) => {
    e.preventDefault();
    setContextMenu({ show: true, x: e.pageX, y: e.pageY, chat, convId });
  };
  
  const handleMessageContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: any) => {
    if (e.type === 'contextmenu') e.preventDefault();
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].pageX;
      y = e.touches[0].pageY;
    } else {
      x = (e as React.MouseEvent).pageX;
      y = (e as React.MouseEvent).pageY;
    }
    setMessageContextMenu({ show: true, x, y, msg });
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent, msg: any) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchEndX - touchStartX.current > 50) { 
      setReplyingTo(msg);
    }
  };

  const toggleArchive = (convId: string) => {
    if (archivedChats.includes(convId)) setArchivedChats(prev => prev.filter(id => id !== convId));
    else setArchivedChats(prev => [...prev, convId]);
    setContextMenu(null);
  };

  const togglePin = (convId: string) => {
    if (pinnedChats.includes(convId)) setPinnedChats(prev => prev.filter(id => id !== convId));
    else setPinnedChats(prev => [...prev, convId]);
    setContextMenu(null);
  };

  const toggleUnread = (convId: string) => {
    if (manualUnread.includes(convId)) setManualUnread(prev => prev.filter(id => id !== convId));
    else setManualUnread(prev => [...prev, convId]);
    setContextMenu(null);
  };

  const toggleBlock = (userId: string) => {
    if (blockedUsers.includes(userId)) setBlockedUsers(prev => prev.filter(id => id !== userId));
    else setBlockedUsers(prev => [...prev, userId]);
  };

  const deleteChatLocal = (convId: string) => {
    setChatMeta(prev => { const newMeta = { ...prev }; delete newMeta[convId]; return newMeta; });
    setContextMenu(null);
    if (activeConversation?.id === convId) setActiveConversation(null);
  };

  const processChatList = (chats: any[], isArchivedView = false) => {
    return chats.filter(item => {
      const convId = item.isGroup ? item.id : `conv_${[user?.id, item.id].sort().join('_')}`;
      const matchesSearch = (item.name || item.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
      const isArchived = archivedChats.includes(convId);
      const hasHistory = chatMeta[convId] !== undefined;
      return matchesSearch && (isArchivedView ? isArchived : (!isArchived && hasHistory));
    }).sort((a, b) => {
      const idA = a.isGroup ? a.id : `conv_${[user?.id, a.id].sort().join('_')}`;
      const idB = b.isGroup ? b.id : `conv_${[user?.id, b.id].sort().join('_')}`;
      
      const isAPinned = pinnedChats.includes(idA);
      const isBPinned = pinnedChats.includes(idB);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;

      const timeA = chatMeta[idA]?.lastMessage?.timestamp || '0';
      const timeB = chatMeta[idB]?.lastMessage?.timestamp || '0';
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  };

  const activeChatListItems = processChatList([...conversations, ...users], false);
  const archivedChatListItems = processChatList([...conversations, ...users], true);
  
  const displayMessages = messages.filter(m => m.type !== 'reaction');
  const allReactions = messages.filter(m => m.type === 'reaction');
  const isCurrentChatBlocked = activeConversation && !activeConversation.isGroup && blockedUsers.includes(activeConversation.user?.id);

  // ================= RENDER =================
  return (
    <div className="relative flex h-[100dvh] w-full bg-[#d1d7db] dark:bg-[#0a1014] overflow-x-hidden transition-colors duration-200">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
      
      <div className="absolute top-0 left-0 w-full h-[127px] bg-[#c62828] dark:bg-[#1a0a0a] z-0 hidden sm:block transition-colors duration-200"></div>

      <div className="relative z-10 flex h-full w-full sm:h-[calc(100vh-38px)] sm:w-[calc(100vw-38px)] sm:mt-[19px] sm:mb-[19px] mx-auto bg-[#f0f2f5] dark:bg-[#111b21] sm:shadow-md sm:rounded-sm overflow-hidden max-w-[1600px] transition-colors duration-200">
        
        {/* MOBILE LAYOUT: SIDEBAR */}
        <div className={`w-full sm:w-[400px] border-r border-[#d1d7db] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex-col shrink-0 h-full relative transition-colors duration-200 ${activeConversation ? 'hidden sm:flex' : 'flex'}`}>
          
          {(sidebarView === 'chats' || sidebarView === 'calls') ? (
            <>
              <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shrink-0 transition-colors duration-200">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setSidebarView('profile')}>
                  <div className="h-10 w-10 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden flex items-center justify-center border-2 border-transparent hover:border-[#fbc02d] transition-colors shrink-0">
                      {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-6 w-6 text-[#c62828] dark:text-[#aebac1]" />}
                  </div>
                  
                  <div className="hidden sm:flex items-center justify-center h-8 w-8 ml-2 rounded-full overflow-hidden border border-[#fbc02d] shadow-sm bg-white shrink-0">
                    <img src={APP_LOGO} alt="EST Logo" className="h-full w-full object-cover scale-[1.2]" />
                  </div>

                </div>
                <div className="flex items-center space-x-2 text-[#54656f] dark:text-[#aebac1] shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setShowNewChat(true)} className="hover:text-[#c62828]"><MessageSquarePlus className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setSidebarView('settings')} className="hover:text-[#c62828]"><Settings className="h-5 w-5" /></Button>
                </div>
              </div>
              
              <div className="p-2 bg-white dark:bg-[#111b21] transition-colors duration-200">
                <div className="relative flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 transition-colors duration-200 focus-within:ring-1 focus-within:ring-[#c62828] min-w-0">
                  <Search className="h-4 w-4 text-[#54656f] dark:text-[#8696a0] shrink-0" />
                  <Input placeholder="Search or start new chat" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none shadow-none focus-visible:ring-0 text-[15px] h-8 ml-2 placeholder:text-[#8696a0] text-[#111b21] dark:text-[#e9edef] w-full" />
                </div>
              </div>

              <div className="flex bg-white dark:bg-[#111b21] border-b border-[#f2f2f2] dark:border-[#222d34] shrink-0 transition-colors duration-200">
                <button className={`flex-1 py-3 text-[14px] font-bold transition-colors border-b-[3px] ${activeTab === 'chats' ? 'text-[#c62828] border-[#c62828] dark:text-[#fbc02d] dark:border-[#fbc02d]' : 'text-[#54656f] dark:text-[#8696a0] border-transparent hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`} onClick={() => setActiveTab('chats')}>Chats</button>
                <button className={`flex-1 py-3 text-[14px] font-bold transition-colors border-b-[3px] ${activeTab === 'calls' ? 'text-[#c62828] border-[#c62828] dark:text-[#fbc02d] dark:border-[#fbc02d]' : 'text-[#54656f] dark:text-[#8696a0] border-transparent hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`} onClick={() => setActiveTab('calls')}>Calls</button>
              </div>
              
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#111b21] transition-colors duration-200 pb-20 sm:pb-0 w-full">
                {activeTab === 'chats' ? (
                  <>
                    {archivedChats.length > 0 && (
                      <div className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors duration-200" onClick={() => setSidebarView('archived')}>
                         <div className="h-12 w-12 shrink-0 mr-3 flex items-center justify-center text-[#c62828] dark:text-[#fbc02d]"><Archive className="h-5 w-5" /></div>
                         <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 flex justify-between items-center min-w-0">
                           <h3 className="text-[17px] text-[#111b21] dark:text-[#e9edef] font-medium truncate">Archived</h3>
                           <span className="text-[#c62828] dark:text-[#fbc02d] text-[12px] font-bold shrink-0">{archivedChats.length}</span>
                         </div>
                      </div>
                    )}

                    {activeChatListItems.length === 0 ? (
                      <div className="p-8 text-center text-[14px] text-[#667781] dark:text-[#8696a0]">Search to start a new chat!</div>
                    ) : (
                      activeChatListItems.map(item => {
                        const isGroup = item.isGroup;
                        const convId = isGroup ? item.id : `conv_${[user?.id, item.id].sort().join('_')}`;
                        const meta = chatMeta[convId];
                        const isManualUnread = manualUnread.includes(convId);
                        const hasUnread = meta?.unreadCount > 0 || isManualUnread;
                        const isPinned = pinnedChats.includes(convId);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`flex cursor-pointer items-center px-3 py-3 hover:bg-[#fff9c4] dark:hover:bg-[#202c33] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200 ${activeConversation?.id === convId ? 'bg-[#ffebee] dark:bg-[#3e1111]' : ''}`} 
                            onClick={() => isGroup ? startGroupConversation(item) : startConversation(item)}
                            onContextMenu={(e) => handleContextMenu(e, item, convId)}
                          >
                              <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden mr-3 flex items-center justify-center bg-[#ffebee] dark:bg-[#54656f]">
                                {isGroup ? <div className="h-full w-full bg-[#fbc02d] dark:bg-[#c62828] flex items-center justify-center"><span className="text-[#c62828] dark:text-[#fbc02d] font-extrabold text-lg">{item.name.charAt(0).toUpperCase()}</span></div> : item.avatar_url ? <img src={item.avatar_url} alt={item.name} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#c62828] dark:text-[#aebac1]" strokeWidth={1.5} />}
                              </div>
                              <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <h3 className={`text-[17px] text-[#111b21] dark:text-[#e9edef] ${hasUnread ? 'font-bold' : 'font-normal'} truncate`}>{item.name || item.phone}</h3>
                                  {meta?.lastMessage && <span className={`text-xs ml-2 shrink-0 ${hasUnread ? 'text-[#c62828] dark:text-[#fbc02d] font-bold' : 'text-[#667781] dark:text-[#8696a0]'}`}>{formatChatTime(meta.lastMessage.timestamp)}</span>}
                                </div>
                                <div className="flex justify-between items-center min-w-0">
                                  <p className="text-[14px] text-[#667781] dark:text-[#8696a0] truncate pr-4 flex items-center min-w-0">
                                      {meta?.lastMessage?.sender_id === user?.id && (
                                        <span className="mr-1 inline-block align-middle shrink-0">
                                          {meta.lastMessage.status === 'read' ? <CheckCheck className="h-4 w-4 text-[#fbc02d]" /> : meta.lastMessage.status === 'delivered' ? <CheckCheck className="h-4 w-4 text-[#8696a0]" /> : <Check className="h-4 w-4 text-[#8696a0]" />}
                                        </span>
                                      )}
                                      <span className="truncate">{renderLastMessagePreview(meta?.lastMessage)}</span>
                                  </p>
                                  <div className="flex items-center space-x-2 shrink-0">
                                    {isPinned && <Pin className="h-4 w-4 text-[#8696a0]" fill="currentColor" />}
                                    {hasUnread && <div className="bg-[#fbc02d] text-[#111b21] text-[11px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shrink-0">{meta.unreadCount || ''}</div>}
                                  </div>
                                </div>
                              </div>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  callHistory.length === 0 ? (
                    <div className="p-8 text-center text-[14px] text-[#667781] dark:text-[#8696a0]">No recent calls</div>
                  ) : (
                    callHistory.map(call => {
                      const otherUserId = call.conversation_id.replace('conv_', '').split('_').find((id: string) => id !== user?.id);
                      const otherUser = users.find(u => u.id === otherUserId);
                      let callData = { type: 'voice', duration: 0 };
                      try { callData = JSON.parse(call.content); } catch (e) {}
                      const isIncoming = call.sender_id !== user?.id;
                      const isMissed = call.status === 'missed';
                      
                      return (
                        <div key={call.id} className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#fff9c4] dark:hover:bg-[#202c33] hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200" onClick={() => { if (otherUser) { setActiveTab('chats'); startConversation(otherUser); }}}>
                          <div className="h-12 w-12 shrink-0 rounded-full bg-[#ffebee] dark:bg-[#54656f] overflow-hidden mr-3 flex items-center justify-center">
                            {otherUser?.avatar_url ? <img src={otherUser.avatar_url} alt={otherUser?.name} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#c62828] dark:text-[#aebac1]" strokeWidth={1.5} />}
                          </div>
                          <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 flex justify-between items-center min-w-0">
                            <div className="flex-1 min-w-0">
                              <h3 className={`text-[17px] truncate ${isMissed ? 'text-red-500' : 'text-[#111b21] dark:text-[#e9edef]'}`}>{otherUser?.name || otherUser?.phone || 'Unknown'}</h3>
                              <div className="flex items-center text-[13px] text-[#667781] dark:text-[#8696a0] mt-0.5 truncate">
                                {isIncoming ? <Phone className={`h-3 w-3 mr-1 shrink-0 ${isMissed ? 'text-red-500' : 'text-[#c62828] dark:text-[#fbc02d]'} rotate-[135deg]`} /> : <Phone className={`h-3 w-3 mr-1 shrink-0 ${isMissed ? 'text-red-500' : 'text-[#8696a0]'}`} />}
                                <span>{callData.type === 'video' ? 'Video' : 'Voice'}</span><span className="mx-1">•</span><span>{formatChatTime(call.timestamp)}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pl-2 shrink-0">
                               <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (otherUser) initiateCall(otherUser.id, callData.type === 'video'); }} className="h-10 w-10 text-[#c62828] dark:text-[#fbc02d] hover:bg-[#ffebee] dark:hover:bg-[#202c33] rounded-full">
                                 {callData.type === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                               </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </>
          ) : sidebarView === 'archived' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Archived</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#111b21]">
                 {archivedChatListItems.length === 0 ? <div className="p-8 text-center text-[14px] text-[#667781] dark:text-[#8696a0]">No archived chats.</div> : (
                    archivedChatListItems.map(item => {
                      const isGroup = item.isGroup;
                      const convId = isGroup ? item.id : `conv_${[user?.id, item.id].sort().join('_')}`;
                      const meta = chatMeta[convId];
                      return (
                        <div key={item.id} className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#fff9c4] dark:hover:bg-[#202c33] transition-colors duration-200" 
                             onClick={() => isGroup ? startGroupConversation(item) : startConversation(item)}
                             onContextMenu={(e) => handleContextMenu(e, item, convId)}>
                            <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden mr-3 flex items-center justify-center bg-[#ffebee] dark:bg-[#54656f]">
                               {isGroup ? <span className="text-[#c62828] font-bold text-lg">{item.name.charAt(0).toUpperCase()}</span> : item.avatar_url ? <img src={item.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#c62828] dark:text-[#aebac1]" strokeWidth={1.5} />}
                            </div>
                            <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="text-[17px] text-[#111b21] dark:text-[#e9edef] truncate">{item.name || item.phone}</h3>
                                {meta?.lastMessage && <span className="text-xs ml-2 text-[#667781] dark:text-[#8696a0] shrink-0">{formatChatTime(meta.lastMessage.timestamp)}</span>}
                              </div>
                              <p className="text-[14px] text-[#667781] dark:text-[#8696a0] truncate pr-4">{renderLastMessagePreview(meta?.lastMessage)}</p>
                            </div>
                        </div>
                      )
                    })
                 )}
               </div>
            </div>
          ) : sidebarView === 'profile' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-left duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Profile</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center">
                  <div className="w-full bg-white dark:bg-[#111b21] p-7 flex justify-center shadow-sm mb-3 transition-colors duration-200">
                    <div className="relative h-48 w-48 rounded-full bg-[#ffebee] dark:bg-[#54656f] overflow-hidden group cursor-pointer flex items-center justify-center shrink-0">
                      {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-24 w-24 text-[#c62828] dark:text-[#aebac1]" />}
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="h-6 w-6 text-white mb-2" /><span className="text-xs text-white uppercase text-center px-4 font-medium">Change Profile Photo</span></div>
                      <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="w-full bg-white dark:bg-[#111b21] p-4 sm:px-7 shadow-sm transition-colors duration-200">
                     <p className="text-[#c62828] dark:text-[#fbc02d] text-[14px] font-bold mb-4">Your name</p>
                     <div className="flex items-center border-b-2 border-transparent focus-within:border-[#c62828] dark:focus-within:border-[#fbc02d] pb-1 min-w-0">
                       <Input value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveProfileName} className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 text-[17px] text-[#111b21] dark:text-[#e9edef] bg-transparent w-full" />
                       <Check className="h-5 w-5 text-[#8696a0] cursor-pointer hover:text-[#c62828] dark:hover:text-[#fbc02d] shrink-0" onClick={saveProfileName} />
                     </div>
                     <p className="text-[14px] text-[#8696a0] mt-4">This is not your username or pin. This name will be visible to your MedLine contacts.</p>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'settings' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-left duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Settings</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="flex items-center px-4 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33] bg-white dark:bg-[#111b21] border-b border-[#f2f2f2] dark:border-[#222d34] transition-colors duration-200 min-w-0" onClick={() => setSidebarView('profile')}>
                    <div className="h-16 w-16 rounded-full bg-[#ffebee] dark:bg-[#54656f] overflow-hidden mr-4 flex items-center justify-center shrink-0">
                        {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#c62828] dark:text-[#aebac1]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[17px] text-[#111b21] dark:text-[#e9edef] font-bold truncate">{myProfile?.name || 'User'}</h2>
                      <p className="text-[14px] text-[#667781] dark:text-[#8696a0] truncate">{myProfile?.phone || myProfile?.email}</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm transition-colors duration-200">
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy')}><Lock className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-6 shrink-0" /><span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Privacy</span></div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('notifications')}><Bell className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-6 shrink-0" /><span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Notifications</span></div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('theme')}><Moon className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-6 shrink-0" /><span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Theme</span></div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#ffebee] dark:hover:bg-[#3e1111] text-red-600 font-bold" onClick={signOut}><LogOut className="h-5 w-5 mr-6 shrink-0" /><span className="text-[16px]">Log out</span></div>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-30 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Privacy</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21] py-2 transition-colors duration-200">
                  <div className="px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy-last-seen')}>
                     <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Last seen and online</h3>
                     <p className="text-[14px] text-[#667781] dark:text-[#8696a0] mt-1">{privacyLastSeen === 'everyone' ? 'Everyone' : privacyLastSeen === 'contacts' ? 'My contacts' : 'Nobody'}</p>
                  </div>
                  <div className="px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy-profile-photo')}>
                     <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Profile photo</h3>
                     <p className="text-[14px] text-[#667781] dark:text-[#8696a0] mt-1">{privacyProfilePhoto === 'everyone' ? 'Everyone' : privacyProfilePhoto === 'contacts' ? 'My contacts' : 'Nobody'}</p>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy-last-seen' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('privacy')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Last seen and online</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#c62828] dark:text-[#fbc02d] font-bold">Who can see my last seen</p>
                     {['everyone', 'contacts', 'nobody'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setPrivacyLastSeen(option)}>
                         {privacyLastSeen === option ? <CheckCircle2 className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-4 shrink-0" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4 shrink-0" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">{option === 'everyone' ? 'Everyone' : option === 'contacts' ? 'My contacts' : 'Nobody'}</span>
                       </div>
                     ))}
                  </div>
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#c62828] dark:text-[#fbc02d] font-bold">Who can see when I'm online</p>
                     {['everyone', 'same_as_last_seen'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setPrivacyOnline(option)}>
                         {privacyOnline === option ? <CheckCircle2 className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-4 shrink-0" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4 shrink-0" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">{option === 'everyone' ? 'Everyone' : 'Same as last seen'}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy-profile-photo' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('privacy')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Profile photo</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#c62828] dark:text-[#fbc02d] font-bold">Who can see my profile photo</p>
                     {['everyone', 'contacts', 'nobody'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setPrivacyProfilePhoto(option)}>
                         {privacyProfilePhoto === option ? <CheckCircle2 className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-4 shrink-0" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4 shrink-0" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">{option === 'everyone' ? 'Everyone' : option === 'contacts' ? 'My contacts' : 'Nobody'}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'theme' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Theme</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#c62828] dark:text-[#fbc02d] font-bold">Choose theme</p>
                     {['light', 'dark', 'system'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setTheme(option)}>
                         {theme === option ? <CheckCircle2 className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-4 shrink-0" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4 shrink-0" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef] capitalize font-medium">{option === 'system' ? 'System default' : option}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'notifications' ? (
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#b71c1c] dark:bg-[#1a0a0a] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Notifications</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#fff9c4] dark:hover:bg-[#202c33]" onClick={() => setSoundsEnabled(!soundsEnabled)}>
                         {soundsEnabled ? <CheckCircle2 className="h-5 w-5 text-[#c62828] dark:text-[#fbc02d] mr-4 shrink-0" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4 shrink-0" />}
                         <div>
                           <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Sounds</h3>
                           <p className="text-[14px] text-[#667781] dark:text-[#8696a0]">Play sounds for incoming messages</p>
                         </div>
                     </div>
                  </div>
               </div>
            </div>
          ) : null}

          {contextMenu && (
             <div className="fixed z-[9999] bg-white dark:bg-[#233138] shadow-2xl rounded-md py-2 w-48 border border-slate-200 dark:border-slate-700" 
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px] font-medium" onClick={() => toggleArchive(contextMenu.convId)}>
                   {archivedChats.includes(contextMenu.convId) ? 'Unarchive chat' : 'Archive chat'}
                </div>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px] font-medium" onClick={() => togglePin(contextMenu.convId)}>
                   {pinnedChats.includes(contextMenu.convId) ? 'Unpin chat' : 'Pin to top'}
                </div>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px] font-medium" onClick={() => toggleUnread(contextMenu.convId)}>
                   {manualUnread.includes(contextMenu.convId) ? 'Mark as read' : 'Mark as unread'}
                </div>
                <div className="px-4 py-2 hover:bg-[#ffebee] dark:hover:bg-[#3e1111] cursor-pointer text-red-600 font-bold text-[14px]" onClick={() => deleteChatLocal(contextMenu.convId)}>
                   Delete chat
                </div>
             </div>
          )}
        </div>

        {/* MAIN CHAT AREA */}
        <div className={`flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden h-full sm:border-l border-[#d1d7db] dark:border-[#222d34] transition-colors duration-200 w-full ${!activeConversation ? 'hidden sm:flex' : 'flex sm:w-auto'}`} 
             style={{ 
                backgroundImage: activeConversation 
                  ? (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) 
                     ? 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' 
                     : 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")')
                  : 'none', 
                backgroundRepeat: 'repeat', 
                backgroundSize: '400px', 
                opacity: activeConversation ? (theme === 'dark' ? 0.2 : 0.8) : 1 
             }}>
          {activeConversation ? (
            <>
              <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between z-10 transition-colors duration-200 shrink-0 w-full">
                <div className="flex items-center cursor-pointer min-w-0 flex-1" onClick={() => setShowContactInfo(true)}>
                  <Button variant="ghost" size="icon" className="sm:hidden mr-1 -ml-2 shrink-0 hover:text-[#c62828]" onClick={(e) => { e.stopPropagation(); setActiveConversation(null); }}>
                    <ArrowLeft className="h-6 w-6 text-[#54656f] dark:text-[#aebac1]" />
                  </Button>
                  <div className="h-10 w-10 rounded-full bg-[#ffebee] dark:bg-[#54656f] overflow-hidden mr-3 flex items-center justify-center shrink-0">
                      {activeConversation.isGroup ? <span className="text-[#c62828] dark:text-[#fbc02d] font-bold text-lg">{activeConversation.name.charAt(0).toUpperCase()}</span> : activeConversation.user?.avatar_url ? <img src={activeConversation.user.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-6 w-6 text-[#c62828] dark:text-[#aebac1]" />}
                  </div>
                  <div className="min-w-0 pr-2">
                    <h2 className="text-[16px] font-bold text-[#111b21] dark:text-[#e9edef] leading-tight truncate">
                      {activeConversation.isGroup ? activeConversation.name : (activeConversation.user?.name || activeConversation.user?.phone)}
                    </h2>
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate font-medium">
                      {remoteTyping ? <span className="text-[#c62828] dark:text-[#fbc02d]">typing...</span> : activeConversation.isGroup ? `${activeConversation.participants.length} members` : (activeConversation.user?.is_online ? 'online' : `last seen ${formatChatTime(activeConversation.user?.last_seen) || 'recently'}`)}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1 sm:space-x-2 text-[#54656f] dark:text-[#aebac1] shrink-0 items-center">
                  {!activeConversation.isGroup && !blockedUsers.includes(activeConversation.user?.id) && (
                    <>
                      <Button variant="ghost" size="icon" className="hover:text-[#c62828]" onClick={(e) => { e.stopPropagation(); initiateCall(activeConversation.user.id, true); }}><Video className="h-5 w-5" /></Button>
                      <Button variant="ghost" size="icon" className="hover:text-[#c62828]" onClick={(e) => { e.stopPropagation(); initiateCall(activeConversation.user.id, false); }}><Phone className="h-5 w-5" /></Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 space-y-2 z-10 w-full" onClick={() => setShowEmojiPicker(false)}>
                {displayMessages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  const messageReactions = allReactions.filter(r => { try { return JSON.parse(r.content).targetId === msg.id; } catch(e) { return false; } });
                  
                  return (
                    <div key={msg.id || idx} className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`} ref={(el) => { if (el && !isMe && msg.status !== 'read' && observer.current) { observer.current.observe(el); } }} data-message-id={msg.id} data-sender-id={msg.sender_id} data-status={msg.status} data-type={msg.type}>
                      <div className="flex items-start max-w-[85%] sm:max-w-[65%] relative min-w-0">
                        
                        <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }} className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 p-2 text-[#8696a0] hover:text-[#c62828] dark:hover:text-[#fbc02d] ${isMe ? '-left-10' : '-right-10'}`}>
                          <Reply className="h-4 w-4" />
                        </button>

                        <div 
                           className={`rounded-xl px-2.5 py-1.5 shadow-sm text-[14.2px] text-[#111b21] dark:text-[#e9edef] ${isMe ? 'bg-[#ffcdd2] dark:bg-[#7f0000] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'} transition-colors duration-200 cursor-pointer relative min-w-0`}
                           onTouchStart={handleTouchStart}
                           onTouchEnd={(e) => handleTouchEnd(e, msg)}
                           onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                        >
                          
                          {msg.type === 'reply' && (
                            <div className="bg-white/40 dark:bg-black/20 rounded cursor-pointer p-2 mb-1 border-l-4 border-[#c62828] dark:border-[#fbc02d] flex flex-col min-w-0">
                               <span className="text-[12px] font-extrabold text-[#c62828] dark:text-[#fbc02d] truncate">{JSON.parse(msg.content).originalSender}</span>
                               <span className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">{JSON.parse(msg.content).originalText}</span>
                            </div>
                          )}

                          <div className="flex flex-col relative min-w-[70px]">
                             {msg.type === 'image' ? (
                               <img src={msg.content} className="max-w-[200px] sm:max-w-[250px] rounded mb-1" />
                             ) : msg.type === 'audio' ? (
                               <audio controls src={msg.content} className="max-w-[200px] sm:max-w-[250px] h-10 mb-4 mt-1" />
                             ) : msg.type === 'document' ? (
                               <a href={JSON.parse(msg.content).url} target="_blank" rel="noreferrer" className="flex items-center space-x-3 bg-white/40 dark:bg-white/5 p-3 rounded-lg mb-4 mt-1 cursor-pointer hover:bg-white/60 dark:hover:bg-white/10 transition min-w-0">
                                  <FileText className="h-8 w-8 text-[#c62828] dark:text-[#fbc02d] shrink-0" />
                                  <span className="truncate max-w-[150px] text-sm font-medium">{JSON.parse(msg.content).name}</span>
                               </a>
                             ) : msg.type === 'call' ? (
                               <span className="pb-3 pr-14 break-words italic text-sm text-[#667781] dark:text-[#e9edef]/80">{getCallDescription(msg)}</span>
                             ) : msg.type === 'reply' ? (
                               <span className="pb-3 pr-14 break-words">{JSON.parse(msg.content).text}</span>
                             ) : (
                               <span className="pb-3 pr-14 break-words">{msg.content}</span>
                             )}
                             
                             <div className="absolute bottom-[-2px] right-0 flex items-center text-[10px] text-[#667781] dark:text-[#e9edef]/60 shrink-0">
                               <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                               {isMe && (
                                 <span className="ml-1">
                                   {msg.status === 'read' ? <CheckCheck className="h-[14px] w-[14px] text-[#fbc02d]" /> : msg.status === 'delivered' ? <CheckCheck className="h-[14px] w-[14px]" /> : <Check className="h-[14px] w-[14px]" />}
                                 </span>
                               )}
                             </div>
                          </div>

                          {messageReactions.length > 0 && (
                            <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex items-center bg-white dark:bg-[#202c33] rounded-full px-1.5 py-0.5 shadow-sm border border-slate-100 dark:border-[#222d34] text-xs`}>
                               {messageReactions.map((r, i) => (
                                 <span key={i}>{JSON.parse(r.content).emoji}</span>
                               ))}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {messageContextMenu && (
                <div className="fixed z-[9999] bg-white dark:bg-[#233138] shadow-2xl rounded-xl py-2 w-auto min-w-[200px] border border-slate-200 dark:border-slate-700" 
                     style={{ top: messageContextMenu.y, left: messageContextMenu.x }}
                     onClick={(e) => e.stopPropagation()}>
                   <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                     {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                       <button key={emoji} onClick={() => sendReaction(messageContextMenu.msg.id, emoji)} className="text-xl hover:scale-125 transition-transform duration-200 px-1">
                         {emoji}
                       </button>
                     ))}
                   </div>
                   <div className="px-4 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[15px] font-bold" 
                        onClick={() => { setReplyingTo(messageContextMenu.msg); setMessageContextMenu(null); }}>
                      Reply
                   </div>
                </div>
              )}

              {showEmojiPicker && (
                <div className="absolute bottom-[60px] left-0 z-50 shadow-2xl">
                  <EmojiPicker 
                     theme={theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? Theme.DARK : Theme.LIGHT} 
                     onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} 
                     width={350} 
                     height={400} 
                  />
                </div>
              )}

              {isCurrentChatBlocked ? (
                 <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-4 py-4 z-10 flex justify-center items-center border-t border-[#d1d7db] dark:border-[#222d34] w-full">
                    <p className="text-[14px] text-[#667781] dark:text-[#8696a0] font-medium text-center">
                      You blocked this contact. <span className="cursor-pointer text-[#c62828] dark:text-[#fbc02d] hover:underline font-bold" onClick={() => toggleBlock(activeConversation.user?.id)}>Tap to unblock.</span>
                    </p>
                 </div>
              ) : (
                <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-4 py-2 sm:py-3 z-10 flex flex-col border-t border-[#d1d7db] dark:border-[#222d34] transition-colors duration-200 shrink-0 w-full">
                  {replyingTo && (
                    <div className="bg-[#f0f2f5] dark:bg-[#202c33] mb-2 px-2 flex transition-colors duration-200 min-w-0">
                       <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg p-3 border-l-4 border-[#c62828] dark:border-[#fbc02d] shadow-sm relative min-w-0">
                         <button type="button" onClick={() => setReplyingTo(null)} className="absolute top-2 right-2 text-[#8696a0] hover:text-[#c62828]"><X className="h-4 w-4" /></button>
                         <p className="text-[13px] font-extrabold text-[#c62828] dark:text-[#fbc02d] truncate">{replyingTo.sender_id === user?.id ? 'You' : 'User'}</p>
                         <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate pr-8">
                           {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'audio' ? '🎤 Voice message' : replyingTo.type === 'document' ? '📄 Document' : replyingTo.type === 'call' ? getCallDescription(replyingTo) : replyingTo.type === 'reply' ? JSON.parse(replyingTo.content).text : replyingTo.content}
                         </p>
                       </div>
                    </div>
                  )}
                  
                  <form onSubmit={sendMessage} className="flex items-center space-x-1 sm:space-x-3 relative w-full">
                    
                    <Button type="button" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0] shrink-0 hover:text-[#c62828]" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                       <Smile className="h-6 w-6" />
                    </Button>
                    
                    <div className="relative shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0] hover:text-[#c62828]"><Paperclip className="h-6 w-6" /></Button>
                      <input type="file" accept="*/*" onChange={handleFileUpload} className="absolute inset-0 cursor-pointer opacity-0 w-full h-full" title="Attach file" />
                    </div>
                    
                    {isRecording ? (
                       <div className="flex-1 flex items-center justify-between bg-white dark:bg-[#2a3942] rounded-full px-4 py-2 sm:py-3 shadow-sm border border-red-500/50 min-w-0">
                          <div className="flex items-center text-red-600 animate-pulse font-bold">
                            <Mic className="h-5 w-5 mr-2 shrink-0" />
                            <span>{formatDuration(recordingTime)}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={stopRecording} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full h-8 w-8 shrink-0">
                            <StopCircle className="h-6 w-6" />
                          </Button>
                       </div>
                    ) : (
                      <Input value={newMessage} onChange={handleTyping} onClick={() => setShowEmojiPicker(false)} placeholder="Type a message" className="flex-1 rounded-full bg-white dark:bg-[#2a3942] border-none py-3 px-4 shadow-sm focus-visible:ring-0 text-[15px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#8696a0] min-w-0 w-full" />
                    )}

                    {newMessage.trim() ? (
                      <Button type="submit" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0] hover:text-[#c62828] dark:hover:text-[#fbc02d] shrink-0">
                        <Send className="h-6 w-6" />
                      </Button>
                    ) : isRecording ? null : (
                      <Button type="button" variant="ghost" size="icon" onClick={startRecording} className="text-[#54656f] dark:text-[#8696a0] hover:text-[#c62828] dark:hover:text-[#fbc02d] shrink-0">
                        <Mic className="h-6 w-6" />
                      </Button>
                    )}
                  </form>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center border-b-[6px] border-[#fbc02d] z-10 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200 dark:from-[#0a1014] dark:to-[#111b21] w-full transition-colors duration-200">
               
               <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#c62828]/20 rounded-full blur-3xl animate-pulse"></div>
               <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#fbc02d]/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

               <div className="relative z-10 group perspective-1000 animate-float w-full flex justify-center">
                 <div className="w-[90%] max-w-[450px] p-6 sm:p-10 rounded-3xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-500 flex flex-col items-center text-center">
                    
                    <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-8">
                      <div className="absolute inset-[-10px] bg-gradient-to-r from-[#c62828] to-[#fbc02d] rounded-full animate-spin blur-lg opacity-70"></div>
                      <div className="relative z-10 w-full h-full rounded-full border-4 border-white dark:border-[#111b21] overflow-hidden shadow-xl bg-white">
                         <img src={APP_LOGO} alt="EST Logo" className="w-full h-full object-cover scale-[1.2]" />
                      </div>
                    </div>
                    
                    <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#c62828] to-[#fbc02d] mb-4">MedLine Ultra</h1>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-8 leading-relaxed font-medium px-2">
                      Welcome to the ultimate messaging experience. Select a chat to begin.
                    </p>
                    
                    <div className="flex space-x-3">
                      <span className="px-4 py-1.5 rounded-full bg-[#ffebee] text-[#c62828] dark:bg-[#7f0000]/30 dark:text-[#ffcdd2] text-xs font-extrabold uppercase tracking-wider shadow-sm">Fast</span>
                      <span className="px-4 py-1.5 rounded-full bg-[#fff8e1] text-[#f57f17] dark:bg-[#fbc02d]/20 dark:text-[#fdd835] text-xs font-extrabold uppercase tracking-wider shadow-sm">Secure</span>
                    </div>

                 </div>
               </div>
               
               <div className="absolute bottom-6 sm:bottom-10 flex items-center space-x-1.5 text-[#8696a0] text-[13px] font-medium">
                 <Lock className="h-3 w-3" />
                 <span>End-to-end encrypted</span>
               </div>
            </div>
          )}
        </div>

        {showContactInfo && activeConversation && !activeConversation.isGroup && (
           <div className="absolute inset-0 sm:relative sm:inset-auto flex w-full sm:w-[350px] border-l border-[#d1d7db] dark:border-[#222d34] bg-[#f0f2f5] dark:bg-[#111b21] flex-col z-[60] animate-in slide-in-from-right duration-300">
              <div className="h-16 px-6 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center shadow-sm shrink-0">
                 <Button variant="ghost" size="icon" onClick={() => setShowContactInfo(false)} className="mr-4 text-[#54656f] dark:text-[#aebac1] hover:text-[#c62828]">
                   <X className="h-5 w-5" />
                 </Button>
                 <h2 className="text-[16px] font-bold text-[#111b21] dark:text-[#e9edef]">Contact info</h2>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                 <div className="bg-white dark:bg-[#111b21] flex flex-col items-center py-8 shadow-sm mb-2 w-full">
                    <div className="h-48 w-48 rounded-full bg-[#ffebee] dark:bg-[#54656f] overflow-hidden mb-4 flex items-center justify-center border-4 border-transparent hover:border-[#fbc02d] transition-colors shrink-0">
                       {activeConversation.user?.avatar_url ? <img src={activeConversation.user.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-24 w-24 text-[#c62828] dark:text-[#aebac1]" />}
                    </div>
                    <h2 className="text-[20px] text-[#111b21] dark:text-[#e9edef] font-bold text-center px-4 truncate w-full">{activeConversation.user?.name || 'User'}</h2>
                    <p className="text-[16px] text-[#667781] dark:text-[#8696a0] mt-1 font-medium">{activeConversation.user?.phone}</p>
                 </div>
                 <div className="bg-white dark:bg-[#111b21] p-5 shadow-sm mb-2">
                    <p className="text-[14px] text-[#c62828] dark:text-[#fbc02d] font-bold mb-1">About and phone number</p>
                    <p className="text-[16px] text-[#111b21] dark:text-[#e9edef] font-medium">Hey there! I am using MedLine.</p>
                 </div>
                 
                 <div 
                    className="bg-white dark:bg-[#111b21] p-4 shadow-sm text-red-600 cursor-pointer hover:bg-[#ffebee] dark:hover:bg-[#3e1111] flex items-center transition-colors" 
                    onClick={() => toggleBlock(activeConversation.user?.id)}
                 >
                    <Lock className="h-5 w-5 mr-4 shrink-0" />
                    <span className="text-[16px] font-bold truncate">
                      {blockedUsers.includes(activeConversation.user?.id) ? `Unblock ${activeConversation.user?.name || 'User'}` : `Block ${activeConversation.user?.name || 'User'}`}
                    </span>
                 </div>
              </div>
           </div>
        )}

        {(incomingCall || currentCall) && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 text-white w-full h-[100dvh] overflow-hidden">
            {incomingCall && !currentCall && (
              <div className="flex flex-col items-center space-y-8">
                <div className="h-32 w-32 overflow-hidden rounded-full bg-slate-800 border-4 border-[#fbc02d] shadow-[0_0_30px_rgba(251,192,45,0.5)] bg-white shrink-0">
                  <img src={APP_LOGO} alt="Incoming Call" className="h-full w-full object-cover scale-[1.2]" />
                </div>
                <h2 className="text-2xl font-bold animate-pulse text-[#fbc02d]">Incoming Call...</h2>
                <div className="flex space-x-6">
                  <Button onClick={answerCall} className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 shadow-lg hover:scale-105 transition-transform"><Phone className="h-8 w-8" /></Button>
                  <Button onClick={rejectCall} className="h-16 w-16 rounded-full bg-[#c62828] hover:bg-red-700 shadow-lg hover:scale-105 transition-transform"><Phone className="h-8 w-8 rotate-[135deg]" /></Button>
                </div>
                <audio ref={incomingAudioRef} src={CUSTOM_RINGTONE} loop />
              </div>
            )}
            
            {currentCall && (
              <div className="relative h-full w-full bg-black overflow-hidden">
                {isVideo && (
                  <>
                    <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className={`absolute bottom-28 sm:bottom-8 right-4 sm:right-8 h-40 sm:h-48 w-28 sm:w-32 rounded-xl object-cover shadow-[0_0_20px_rgba(251,192,45,0.3)] border-2 border-[#fbc02d] transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'} z-20`} 
                    />
                  </>
                )}

                {!isVideo && (
                  <div className="flex h-full flex-col items-center justify-center space-y-8">
                    <div className="h-32 w-32 overflow-hidden rounded-full bg-slate-800 border-4 border-[#fbc02d] bg-white shrink-0"><img src={APP_LOGO} alt="Call" className="h-full w-full object-cover scale-[1.2]" /></div>
                    <h2 className="text-2xl font-bold text-[#fbc02d]">{remoteStream ? 'In Call' : 'Calling...'}</h2>
                    <p className="text-slate-300 font-mono text-xl font-medium">{remoteStream ? formatDuration(callDuration) : 'Connecting...'}</p>
                  </div>
                )}

                <div className="absolute bottom-8 sm:bottom-12 left-1/2 flex -translate-x-1/2 space-x-4 sm:space-x-6 z-30">
                  <Button onClick={toggleMute} className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full transition-all hover:scale-105 shrink-0 ${isMuted ? 'bg-[#c62828]' : 'bg-slate-700/80 backdrop-blur-md hover:bg-slate-600'}`}>
                    {isMuted ? <MicOff className="h-6 w-6 sm:h-8 sm:w-8 text-white" /> : <Mic className="h-6 w-6 sm:h-8 sm:w-8 text-white" />}
                  </Button>

                  {isVideo && (
                    <>
                      <Button onClick={toggleVideo} className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full transition-all hover:scale-105 shrink-0 ${isVideoOff ? 'bg-[#c62828]' : 'bg-slate-700/80 backdrop-blur-md hover:bg-slate-600'}`}>
                        {isVideoOff ? <VideoOff className="h-6 w-6 sm:h-8 sm:w-8 text-white" /> : <Video className="h-6 w-6 sm:h-8 sm:w-8 text-white" />}
                      </Button>
                      <Button onClick={cycleFilter} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-[#fbc02d] hover:bg-yellow-500 shadow-[0_0_15px_rgba(251,192,45,0.5)] transition-all hover:scale-105 shrink-0">
                        <Wand2 className="h-6 w-6 sm:h-8 sm:w-8 text-[#111b21]" />
                      </Button>
                    </>
                  )}

                  <Button onClick={() => endCall()} className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-[#c62828] hover:bg-red-700 shadow-[0_0_15px_rgba(198,40,40,0.5)] transition-all hover:scale-105 shrink-0">
                    <Phone className="h-6 w-6 sm:h-8 sm:w-8 rotate-[135deg] text-white" />
                  </Button>
                </div>
                <audio ref={outgoingAudioRef} src="https://actions.google.com/sounds/v1/communications/telephone_ring.ogg" loop />
              </div>
            )}
          </div>
        )}

        {showNewChat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 w-full h-[100dvh]">
            <div className="bg-white dark:bg-[#111b21] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-[#c62828] px-6 py-4 flex items-center justify-between">
                <h2 className="text-white text-[19px] font-bold">Start New Chat</h2>
                <button onClick={() => setShowNewChat(false)} className="text-white/80 hover:text-white shrink-0"><X className="h-6 w-6" /></button>
              </div>
              <form onSubmit={handleStartNewChat} className="p-6">
                <p className="text-[#667781] dark:text-[#8696a0] mb-4 text-[14px]">Enter the registered phone number of the person you want to contact.</p>
                <div className="mb-6">
                  <Input
                    autoFocus
                    placeholder="e.g. +1234567890"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="w-full bg-[#f0f2f5] dark:bg-[#2a3942] border-none text-[16px] py-6 px-4 rounded-xl text-[#111b21] dark:text-[#e9edef] focus-visible:ring-1 focus-visible:ring-[#c62828]"
                  />
                  {searchError && <p className="text-red-500 text-sm mt-2 font-medium">{searchError}</p>}
                </div>
                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="ghost" onClick={() => setShowNewChat(false)} className="text-[#667781] dark:text-[#8696a0] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]">Cancel</Button>
                  <Button type="submit" className="bg-[#c62828] hover:bg-[#b71c1c] text-white rounded-xl px-6 shrink-0">Chat</Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}