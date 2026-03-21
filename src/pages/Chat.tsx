import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useCall } from '@/src/contexts/CallContext';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Phone, Video, Send, Image as ImageIcon, Paperclip, LogOut, User as UserIcon, Check, CheckCheck, Mic, MicOff, VideoOff, Settings, Search, Reply, X, MessageSquarePlus, Lock, Laptop, Smartphone, ArrowLeft, Camera, Bell, Moon, ChevronRight, Circle, CheckCircle2, Archive, Pin, MoreVertical } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { playNotificationSound, showNotification } from '@/src/hooks/useNotifications';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const formatChatTime = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
};

type SidebarView = 'chats' | 'calls' | 'settings' | 'profile' | 'privacy' | 'privacy-last-seen' | 'privacy-profile-photo' | 'theme' | 'notifications' | 'archived';

export default function Chat() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { initiateCall, incomingCall, currentCall, answerCall, rejectCall, endCall, localStream, remoteStream, isVideo, isCaller } = useCall();
  
  // Main States
  const [sidebarView, setSidebarView] = useState<SidebarView>('chats');
  const [activeTab, setActiveTab] = useState<'chats' | 'calls'>('chats');
  const [loading, setLoading] = useState(true);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // User Profile & Privacy State
  const [myProfile, setMyProfile] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [privacyLastSeen, setPrivacyLastSeen] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');
  const [privacyOnline, setPrivacyOnline] = useState<'everyone' | 'same_as_last_seen'>('everyone');
  const [privacyProfilePhoto, setPrivacyProfilePhoto] = useState<'everyone' | 'contacts' | 'nobody'>('everyone');

  // Settings States (Persisted)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(localStorage.getItem('whatsapp_theme') as any || 'system');
  const [soundsEnabled, setSoundsEnabled] = useState(localStorage.getItem('whatsapp_sounds') !== 'false');
  
  // Chat Organization States (Persisted)
  const [archivedChats, setArchivedChats] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_archived') || '[]'));
  const [pinnedChats, setPinnedChats] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_pinned') || '[]'));
  const [manualUnread, setManualUnread] = useState<string[]>(JSON.parse(localStorage.getItem('whatsapp_unread') || '[]'));
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ show: boolean, x: number, y: number, chat: any, convId: string } | null>(null);

  // Contacts & Meta
  const [users, setUsers] = useState<any[]>([]);
  const [chatMeta, setChatMeta] = useState<Record<string, { lastMessage: any, unreadCount: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  // Modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchPhone, setSearchPhone] = useState<string | undefined>('');
  const [searchError, setSearchError] = useState('');

  // Stable Refs for Realtime Listeners
  const usersRef = useRef<any[]>([]);
  const chatMetaRef = useRef<any>({});
  const activeConversationRef = useRef<any>(null);
  
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { chatMetaRef.current = chatMeta; }, [chatMeta]);
  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);

  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  
  const callDurationRef = useRef(0);
  const previousCallRef = useRef<any>(null);

  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Apply Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('whatsapp_theme', theme);
  }, [theme]);

  // Persist Local Arrays
  useEffect(() => { localStorage.setItem('whatsapp_archived', JSON.stringify(archivedChats)); }, [archivedChats]);
  useEffect(() => { localStorage.setItem('whatsapp_pinned', JSON.stringify(pinnedChats)); }, [pinnedChats]);
  useEffect(() => { localStorage.setItem('whatsapp_unread', JSON.stringify(manualUnread)); }, [manualUnread]);
  useEffect(() => { localStorage.setItem('whatsapp_sounds', soundsEnabled.toString()); }, [soundsEnabled]);

  // Handle outside clicks for context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Initial Load & Presence
  useEffect(() => {
    if (!user) return;
    const fetchMyProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) {
        setMyProfile(data);
        setEditName(data.name || '');
      } else {
        navigate('/profile');
      }
    };
    fetchMyProfile();

    const setOnlineStatus = async (status: boolean) => {
       if (privacyOnline !== 'everyone') return; 
       await supabase.from('users').update({ is_online: status }).eq('id', user.id);
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

  // Load Data & Subscribe to Realtime
  useEffect(() => {
    if (!user) return;
    
    fetchAllChatMetadata();
    fetchConversations();
    fetchCallHistory();

    const messageSubscription = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new;
        const currentActiveChat = activeConversationRef.current;
        
        setChatMeta(prev => {
          const isMyMsg = newMsg.sender_id === user?.id;
          const isActiveChat = currentActiveChat?.id === newMsg.conversation_id;
          const currentCount = prev[newMsg.conversation_id]?.unreadCount || 0;
          return {
            ...prev,
            [newMsg.conversation_id]: {
              lastMessage: newMsg,
              unreadCount: (!isMyMsg && !isActiveChat) ? currentCount + 1 : currentCount
            }
          };
        });

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
          scrollToBottom();
          if (newMsg.sender_id !== user?.id) {
            supabase.from('messages').update({ status: document.visibilityState === 'visible' ? 'read' : 'delivered' }).eq('id', newMsg.id).then();
          }
        } else if (newMsg.sender_id !== user?.id) {
          if (soundsEnabled) playNotificationSound();
          if (document.visibilityState !== 'visible') showNotification("New Message", "You have a new message");
          supabase.from('messages').update({ status: 'delivered' }).eq('id', newMsg.id).then();
        }

        // FIXED UUID EXTRACTION BUG: Using _ instead of -
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
        setChatMeta(prev => {
           if (prev[payload.new.conversation_id]?.lastMessage?.id === payload.new.id) {
               return { ...prev, [payload.new.conversation_id]: { ...prev[payload.new.conversation_id], lastMessage: payload.new } };
           }
           return prev;
        });
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

  // Read Receipts Observer
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
            if (messageId && senderId !== user?.id && status !== 'read') {
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

  // FIXED UUID EXTRACTION BUG
  const fetchAllChatMetadata = async () => {
    if (!user) return;
    const { data: allUserMsgs, error } = await supabase.from('messages').select('*').ilike('conversation_id', `%${user.id}%`).order('timestamp', { ascending: true });
    if (error) console.error("Error fetching chats:", error);
    
    if (allUserMsgs) {
      const meta: Record<string, { lastMessage: any, unreadCount: number }> = {};
      const uniqueUserIds = new Set<string>();

      allUserMsgs.forEach(m => {
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
      const unreadIds = data.filter(m => m.sender_id !== user?.id && m.status !== 'read').map(m => m.id);
      if (unreadIds.length > 0) supabase.from('messages').update({ status: 'read' }).in('id', unreadIds).then();
    }
    scrollToBottom();
  };

  // FIXED UUID CREATION BUG: USING UNDERSCORE _
  const startConversation = async (otherUser: any) => {
    const conversationId = `conv_${[user?.id, otherUser.id].sort().join('_')}`;
    setActiveConversation({ id: conversationId, user: otherUser });
    setReplyingTo(null);
    setChatMeta(prev => ({ ...prev, [conversationId]: { ...prev[conversationId], unreadCount: 0 } }));
    setManualUnread(prev => prev.filter(id => id !== conversationId)); 
    fetchMessages(conversationId);
  };

  const startGroupConversation = async (group: any) => {
    setActiveConversation({ id: group.id, isGroup: true, name: group.name, participants: group.participants });
    setReplyingTo(null);
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
    
    if (error) {
      alert(`Database Search Error: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) { 
      setSearchError('No MedLine user found with this phone number.'); 
      return; 
    }
    
    const contact = data[0];
    setUsers(prev => prev.find(u => u.id === contact.id) ? prev : [...prev, contact]);
    setShowNewChat(false);
    setSearchPhone('');
    setSidebarView('chats');
    setActiveTab('chats');
    startConversation(contact); 
  };

  // FIXED UUID CREATION BUG: USING UNDERSCORE _
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

  // SEND MESSAGE
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !user) return;

    let msgContent = newMessage;
    let msgType = 'text';

    if (replyingTo) {
      msgType = 'reply';
      let originalText = replyingTo.content;
      if (replyingTo.type === 'image') originalText = '📷 Photo';
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
    setReplyingTo(null);
    setMessages(prev => [...prev, newMsgObj]);
    
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

    if (error) {
      alert(`Failed to send message!\nError: ${error.message}`);
      console.error("Supabase Insert Error:", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeConversation) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
    try {
      await supabase.storage.from('chat-media').upload(fileName, file);
      const { data } = supabase.storage.from('chat-media').getPublicUrl(fileName);
      const { error } = await supabase.from('messages').insert([{
        conversation_id: activeConversation.id,
        sender_id: user?.id,
        content: data.publicUrl,
        type: 'image',
        status: 'sent',
        timestamp: new Date().toISOString() 
      }]);
      if (error) alert(`Failed to send image: ${error.message}`);
    } catch (err) { console.error('Error uploading image', err); }
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
    if (error) {
      alert(`Failed to create group: ${error.message}`);
      return;
    }
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

  const renderLastMessagePreview = (msg: any) => {
    if (!msg) return '';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'call') return '📞 Call';
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

  const toggleArchive = (convId: string) => {
    if (archivedChats.includes(convId)) {
      setArchivedChats(prev => prev.filter(id => id !== convId));
    } else {
      setArchivedChats(prev => [...prev, convId]);
    }
    setContextMenu(null);
  };

  const togglePin = (convId: string) => {
    if (pinnedChats.includes(convId)) {
      setPinnedChats(prev => prev.filter(id => id !== convId));
    } else {
      setPinnedChats(prev => [...prev, convId]);
    }
    setContextMenu(null);
  };

  const toggleUnread = (convId: string) => {
    if (manualUnread.includes(convId)) {
      setManualUnread(prev => prev.filter(id => id !== convId));
    } else {
      setManualUnread(prev => [...prev, convId]);
    }
    setContextMenu(null);
  };

  const deleteChatLocal = (convId: string) => {
    setChatMeta(prev => {
      const newMeta = { ...prev };
      delete newMeta[convId];
      return newMeta;
    });
    setContextMenu(null);
    if (activeConversation?.id === convId) setActiveConversation(null);
  };

  // FIXED UUID CREATION BUG: USING UNDERSCORE _
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

  // ================= RENDER =================
  return (
    <div className="relative flex h-screen w-full bg-[#d1d7db] dark:bg-[#0a1014] overflow-hidden transition-colors duration-200">
      {/* Background Strip */}
      <div className="absolute top-0 left-0 w-full h-[127px] bg-[#00a884] dark:bg-[#202c33] z-0 hidden sm:block transition-colors duration-200"></div>

      {/* Main App Container */}
      <div className="relative z-10 flex h-full w-full sm:h-[calc(100vh-38px)] sm:w-[calc(100vw-38px)] sm:mt-[19px] sm:mb-[19px] mx-auto bg-[#f0f2f5] dark:bg-[#111b21] sm:shadow-md sm:rounded-sm overflow-hidden max-w-[1600px] transition-colors duration-200">
        
        {/* MOBILE LAYOUT: SIDEBAR (hides on mobile when chat is active) */}
        <div className={`w-full sm:w-[400px] border-r border-[#d1d7db] dark:border-[#222d34] bg-white dark:bg-[#111b21] flex-col shrink-0 h-full relative transition-colors duration-200 ${activeConversation ? 'hidden sm:flex' : 'flex'}`}>
          
          {/* Main Chats/Calls View */}
          {(sidebarView === 'chats' || sidebarView === 'calls') ? (
            <>
              <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between shrink-0 transition-colors duration-200">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setSidebarView('profile')}>
                  <div className="h-10 w-10 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden flex items-center justify-center">
                      {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-6 w-6 text-white" />}
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-[#54656f] dark:text-[#aebac1]">
                  <Button variant="ghost" size="icon" onClick={() => setShowNewChat(true)}><MessageSquarePlus className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setSidebarView('settings')}><Settings className="h-5 w-5" /></Button>
                </div>
              </div>
              
              <div className="p-2 bg-white dark:bg-[#111b21] transition-colors duration-200">
                <div className="relative flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 transition-colors duration-200">
                  <Search className="h-4 w-4 text-[#54656f] dark:text-[#8696a0]" />
                  <Input 
                    placeholder="Search or start new chat" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none shadow-none focus-visible:ring-0 text-[15px] h-8 ml-2 placeholder:text-[#8696a0] text-[#111b21] dark:text-[#e9edef]"
                  />
                </div>
              </div>

              <div className="flex bg-white dark:bg-[#111b21] border-b border-[#f2f2f2] dark:border-[#222d34] shrink-0 transition-colors duration-200">
                <button
                  className={`flex-1 py-3 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'chats' ? 'text-[#00a884] border-[#00a884]' : 'text-[#54656f] dark:text-[#8696a0] border-transparent hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`}
                  onClick={() => setActiveTab('chats')}
                >Chats</button>
                <button
                  className={`flex-1 py-3 text-[14px] font-medium transition-colors border-b-2 ${activeTab === 'calls' ? 'text-[#00a884] border-[#00a884]' : 'text-[#54656f] dark:text-[#8696a0] border-transparent hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'}`}
                  onClick={() => setActiveTab('calls')}
                >Calls</button>
              </div>
              
              <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21] transition-colors duration-200 pb-20 sm:pb-0">
                {activeTab === 'chats' ? (
                  <>
                    {/* Archived Link */}
                    {archivedChats.length > 0 && (
                      <div className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors duration-200" onClick={() => setSidebarView('archived')}>
                         <div className="h-12 w-12 shrink-0 mr-3 flex items-center justify-center text-[#00a884]">
                           <Archive className="h-5 w-5" />
                         </div>
                         <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 flex justify-between items-center">
                           <h3 className="text-[17px] text-[#111b21] dark:text-[#e9edef] font-medium">Archived</h3>
                           <span className="text-[#00a884] text-[12px] font-medium">{archivedChats.length}</span>
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
                            className={`flex cursor-pointer items-center px-3 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] ${activeConversation?.id === convId ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : ''} transition-colors duration-200`} 
                            onClick={() => isGroup ? startGroupConversation(item) : startConversation(item)}
                            onContextMenu={(e) => handleContextMenu(e, item, convId)}
                          >
                              <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden mr-3 flex items-center justify-center bg-[#dfe5e7] dark:bg-[#54656f]">
                                {isGroup ? (
                                  <div className="h-full w-full bg-[#d9fdd3] dark:bg-[#005c4b] flex items-center justify-center">
                                    <span className="text-[#00a884] dark:text-[#e9edef] font-semibold text-lg">{item.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                ) : item.avatar_url ? (
                                  <img src={item.avatar_url} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <UserIcon className="h-8 w-8 text-[#ffffff] dark:text-[#aebac1]" strokeWidth={1.5} />
                                )}
                              </div>
                              <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                  <h3 className={`text-[17px] text-[#111b21] dark:text-[#e9edef] ${hasUnread ? 'font-bold' : 'font-normal'} truncate`}>{item.name || item.phone}</h3>
                                  {meta?.lastMessage && <span className={`text-xs ml-2 shrink-0 ${hasUnread ? 'text-[#25d366] font-medium' : 'text-[#667781] dark:text-[#8696a0]'}`}>{formatChatTime(meta.lastMessage.timestamp)}</span>}
                                </div>
                                <div className="flex justify-between items-center min-w-0">
                                  <p className="text-[14px] text-[#667781] dark:text-[#8696a0] truncate pr-4 flex items-center min-w-0">
                                      {meta?.lastMessage?.sender_id === user?.id && (
                                        <span className="mr-1 inline-block align-middle shrink-0">
                                          {meta.lastMessage.status === 'read' ? <CheckCheck className="h-4 w-4 text-[#53bdeb]" /> : meta.lastMessage.status === 'delivered' ? <CheckCheck className="h-4 w-4 text-[#8696a0]" /> : <Check className="h-4 w-4 text-[#8696a0]" />}
                                        </span>
                                      )}
                                      <span className="truncate">{renderLastMessagePreview(meta?.lastMessage)}</span>
                                  </p>
                                  <div className="flex items-center space-x-2 shrink-0">
                                    {isPinned && <Pin className="h-4 w-4 text-[#8696a0]" fill="currentColor" />}
                                    {hasUnread && <div className="bg-[#25d366] text-white text-[11px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shrink-0">{meta.unreadCount || ''}</div>}
                                  </div>
                                </div>
                              </div>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  /* CALL HISTORY TAB */
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
                        <div key={call.id} className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors duration-200" onClick={() => { if (otherUser) { setActiveTab('chats'); startConversation(otherUser); }}}>
                          <div className="h-12 w-12 shrink-0 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden mr-3 flex items-center justify-center">
                            {otherUser?.avatar_url ? <img src={otherUser.avatar_url} alt={otherUser?.name} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#ffffff] dark:text-[#aebac1]" strokeWidth={1.5} />}
                          </div>
                          <div className="flex-1 border-b border-[#f2f2f2] dark:border-[#222d34] pb-3 pt-1 pr-2 flex justify-between items-center">
                            <div className="flex-1">
                              <h3 className={`text-[17px] ${isMissed ? 'text-red-500' : 'text-[#111b21] dark:text-[#e9edef]'}`}>{otherUser?.name || otherUser?.phone || 'Unknown'}</h3>
                              <div className="flex items-center text-[13px] text-[#667781] dark:text-[#8696a0] mt-0.5">
                                {isIncoming ? (
                                  <Phone className={`h-3 w-3 mr-1 ${isMissed ? 'text-red-500' : 'text-[#25d366]'} rotate-[135deg]`} />
                                ) : (
                                  <Phone className={`h-3 w-3 mr-1 ${isMissed ? 'text-red-500' : 'text-[#8696a0]'}`} />
                                )}
                                <span>{callData.type === 'video' ? 'Video' : 'Voice'}</span>
                                <span className="mx-1">•</span>
                                <span>{formatChatTime(call.timestamp)}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pl-2">
                               <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (otherUser) initiateCall(otherUser.id, callData.type === 'video'); }} className="h-10 w-10 text-[#00a884] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] rounded-full">
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
            /* ARCHIVED SLIDE-IN */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Archived</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21]">
                 {archivedChatListItems.length === 0 ? (
                   <div className="p-8 text-center text-[14px] text-[#667781] dark:text-[#8696a0]">No archived chats.</div>
                 ) : (
                    archivedChatListItems.map(item => {
                      const isGroup = item.isGroup;
                      const convId = isGroup ? item.id : `conv_${[user?.id, item.id].sort().join('_')}`;
                      const meta = chatMeta[convId];
                      return (
                        <div key={item.id} className="flex cursor-pointer items-center px-3 py-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors duration-200" 
                             onClick={() => isGroup ? startGroupConversation(item) : startConversation(item)}
                             onContextMenu={(e) => handleContextMenu(e, item, convId)}>
                            <div className="h-12 w-12 shrink-0 rounded-full overflow-hidden mr-3 flex items-center justify-center bg-[#dfe5e7] dark:bg-[#54656f]">
                               {isGroup ? <span className="text-[#00a884] font-semibold text-lg">{item.name.charAt(0).toUpperCase()}</span> : item.avatar_url ? <img src={item.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-[#ffffff] dark:text-[#aebac1]" strokeWidth={1.5} />}
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
            /* PROFILE SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-left duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Profile</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto flex flex-col items-center">
                  <div className="w-full bg-white dark:bg-[#111b21] p-7 flex justify-center shadow-sm mb-3 transition-colors duration-200">
                    <div className="relative h-48 w-48 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden group cursor-pointer flex items-center justify-center">
                      {myProfile?.avatar_url ? (
                        <img src={myProfile.avatar_url} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-24 w-24 text-white dark:text-[#aebac1]" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="h-6 w-6 text-white mb-2" />
                         <span className="text-xs text-white uppercase text-center px-4 font-medium">Change Profile Photo</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="w-full bg-white dark:bg-[#111b21] p-4 sm:px-7 shadow-sm transition-colors duration-200">
                     <p className="text-[#008069] dark:text-[#00a884] text-[14px] mb-4">Your name</p>
                     <div className="flex items-center border-b-2 border-transparent focus-within:border-[#008069] dark:focus-within:border-[#00a884] pb-1">
                       <Input value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveProfileName} className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 text-[17px] text-[#111b21] dark:text-[#e9edef] bg-transparent" />
                       <Check className="h-5 w-5 text-[#8696a0] cursor-pointer hover:text-[#111b21] dark:hover:text-[#e9edef]" onClick={saveProfileName} />
                     </div>
                     <p className="text-[14px] text-[#8696a0] mt-4">This is not your username or pin. This name will be visible to your MedLine contacts.</p>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'settings' ? (
            /* SETTINGS SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-20 animate-in slide-in-from-left duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('chats')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Settings</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="flex items-center px-4 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] bg-white dark:bg-[#111b21] border-b border-[#f2f2f2] dark:border-[#222d34] transition-colors duration-200" onClick={() => setSidebarView('profile')}>
                    <div className="h-16 w-16 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden mr-4 flex items-center justify-center">
                        {myProfile?.avatar_url ? <img src={myProfile.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-white dark:text-[#aebac1]" />}
                    </div>
                    <div>
                      <h2 className="text-[17px] text-[#111b21] dark:text-[#e9edef]">{myProfile?.name || 'User'}</h2>
                      <p className="text-[14px] text-[#667781] dark:text-[#8696a0]">{myProfile?.phone || myProfile?.email}</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm transition-colors duration-200">
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy')}>
                        <Lock className="h-5 w-5 text-[#8696a0] mr-6" />
                        <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Privacy</span>
                     </div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('notifications')}>
                        <Bell className="h-5 w-5 text-[#8696a0] mr-6" />
                        <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Notifications</span>
                     </div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('theme')}>
                        <Moon className="h-5 w-5 text-[#8696a0] mr-6" />
                        <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Theme</span>
                     </div>
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] text-red-500" onClick={signOut}>
                        <LogOut className="h-5 w-5 mr-6" />
                        <span className="text-[16px]">Log out</span>
                     </div>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy' ? (
            /* PRIVACY SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-30 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Privacy</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111b21] py-2 transition-colors duration-200">
                  <div className="px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy-last-seen')}>
                     <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Last seen and online</h3>
                     <p className="text-[14px] text-[#667781] dark:text-[#8696a0] mt-1">{privacyLastSeen === 'everyone' ? 'Everyone' : privacyLastSeen === 'contacts' ? 'My contacts' : 'Nobody'}</p>
                  </div>
                  <div className="px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSidebarView('privacy-profile-photo')}>
                     <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Profile photo</h3>
                     <p className="text-[14px] text-[#667781] dark:text-[#8696a0] mt-1">{privacyProfilePhoto === 'everyone' ? 'Everyone' : privacyProfilePhoto === 'contacts' ? 'My contacts' : 'Nobody'}</p>
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy-last-seen' ? (
            /* PRIVACY: LAST SEEN SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('privacy')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Last seen and online</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#008069] dark:text-[#00a884] font-medium">Who can see my last seen</p>
                     {['everyone', 'contacts', 'nobody'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setPrivacyLastSeen(option)}>
                         {privacyLastSeen === option ? <CheckCircle2 className="h-5 w-5 text-[#00a884] mr-4" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">{option === 'everyone' ? 'Everyone' : option === 'contacts' ? 'My contacts' : 'Nobody'}</span>
                       </div>
                     ))}
                  </div>
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#008069] dark:text-[#00a884] font-medium">Who can see when I'm online</p>
                     {['everyone', 'same_as_last_seen'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setPrivacyOnline(option)}>
                         {privacyOnline === option ? <CheckCircle2 className="h-5 w-5 text-[#00a884] mr-4" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">{option === 'everyone' ? 'Everyone' : 'Same as last seen'}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'privacy-profile-photo' ? (
            /* PRIVACY: PROFILE PHOTO SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('privacy')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Profile photo</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#008069] dark:text-[#00a884] font-medium">Who can see my profile photo</p>
                     {['everyone', 'contacts', 'nobody'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setPrivacyProfilePhoto(option)}>
                         {privacyProfilePhoto === option ? <CheckCircle2 className="h-5 w-5 text-[#00a884] mr-4" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef]">{option === 'everyone' ? 'Everyone' : option === 'contacts' ? 'My contacts' : 'Nobody'}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'theme' ? (
            /* THEME SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Theme</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <p className="px-6 py-3 text-[14px] text-[#008069] dark:text-[#00a884] font-medium">Choose theme</p>
                     {['light', 'dark', 'system'].map((option: any) => (
                       <div key={option} className="flex items-center px-6 py-3 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setTheme(option)}>
                         {theme === option ? <CheckCircle2 className="h-5 w-5 text-[#00a884] mr-4" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4" />}
                         <span className="text-[16px] text-[#111b21] dark:text-[#e9edef] capitalize">{option === 'system' ? 'System default' : option}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          ) : sidebarView === 'notifications' ? (
            /* NOTIFICATIONS SLIDE-IN MENU */
            <div className="absolute inset-0 bg-[#f0f2f5] dark:bg-[#111b21] flex flex-col z-40 animate-in slide-in-from-right duration-300 transition-colors duration-200">
               <div className="bg-[#008069] dark:bg-[#202c33] h-[108px] flex items-end pb-4 px-6 text-white shrink-0 shadow-sm transition-colors duration-200">
                 <div className="flex items-center cursor-pointer" onClick={() => setSidebarView('settings')}>
                   <ArrowLeft className="h-6 w-6 mr-6" />
                   <h1 className="text-[19px] font-medium">Notifications</h1>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="bg-white dark:bg-[#111b21] py-2 shadow-sm mb-4 transition-colors duration-200">
                     <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]" onClick={() => setSoundsEnabled(!soundsEnabled)}>
                         {soundsEnabled ? <CheckCircle2 className="h-5 w-5 text-[#00a884] mr-4" /> : <Circle className="h-5 w-5 text-[#8696a0] mr-4" />}
                         <div>
                           <h3 className="text-[16px] text-[#111b21] dark:text-[#e9edef]">Sounds</h3>
                           <p className="text-[14px] text-[#667781] dark:text-[#8696a0]">Play sounds for incoming messages</p>
                         </div>
                     </div>
                  </div>
               </div>
            </div>
          ) : null}

          {/* GLOBAL CONTEXT MENU OVERLAY (Right Click / Long Press) */}
          {contextMenu && (
             <div className="fixed z-50 bg-white dark:bg-[#233138] shadow-lg rounded-md py-2 w-48 border border-slate-200 dark:border-slate-700" 
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px]" onClick={() => toggleArchive(contextMenu.convId)}>
                   {archivedChats.includes(contextMenu.convId) ? 'Unarchive chat' : 'Archive chat'}
                </div>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px]" onClick={() => togglePin(contextMenu.convId)}>
                   {pinnedChats.includes(contextMenu.convId) ? 'Unpin chat' : 'Pin to top'}
                </div>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-[#111b21] dark:text-[#e9edef] text-[14px]" onClick={() => toggleUnread(contextMenu.convId)}>
                   {manualUnread.includes(contextMenu.convId) ? 'Mark as read' : 'Mark as unread'}
                </div>
                <div className="px-4 py-2 hover:bg-[#f5f6f6] dark:hover:bg-[#182229] cursor-pointer text-red-500 text-[14px]" onClick={() => deleteChatLocal(contextMenu.convId)}>
                   Delete chat
                </div>
             </div>
          )}

        </div>

        {/* MAIN CHAT AREA / EMPTY STATE */}
        <div className={`flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] relative overflow-hidden h-full sm:border-l border-[#d1d7db] dark:border-[#222d34] transition-colors duration-200 ${!activeConversation ? 'hidden sm:flex' : 'flex w-full sm:w-auto'}`} 
             style={{ 
                backgroundImage: activeConversation 
                  ? (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) 
                     ? 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' 
                     : 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")')
                  : 'none', 
                backgroundRepeat: 'repeat', 
                backgroundSize: '400px', 
                opacity: activeConversation ? (theme === 'dark' ? 0.3 : 0.9) : 1 
             }}>
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between z-10 transition-colors duration-200 shrink-0">
                <div className="flex items-center cursor-pointer min-w-0">
                  {/* MOBILE BACK BUTTON */}
                  <Button variant="ghost" size="icon" className="sm:hidden mr-1 -ml-2 shrink-0" onClick={() => setActiveConversation(null)}>
                    <ArrowLeft className="h-6 w-6 text-[#54656f] dark:text-[#aebac1]" />
                  </Button>
                  
                  <div className="h-10 w-10 rounded-full bg-[#dfe5e7] dark:bg-[#54656f] overflow-hidden mr-3 flex items-center justify-center shrink-0">
                      {activeConversation.isGroup ? <span className="text-[#00a884] font-semibold flex items-center justify-center h-full text-lg">{activeConversation.name.charAt(0).toUpperCase()}</span> : activeConversation.user?.avatar_url ? <img src={activeConversation.user.avatar_url} className="h-full w-full object-cover" /> : <UserIcon className="h-6 w-6 text-white" />}
                  </div>
                  <div className="min-w-0 pr-2">
                    <h2 className="text-[16px] font-medium text-[#111b21] dark:text-[#e9edef] leading-tight truncate">
                      {activeConversation.isGroup ? activeConversation.name : (activeConversation.user?.name || activeConversation.user?.phone)}
                    </h2>
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">
                      {remoteTyping ? <span className="text-[#00a884]">typing...</span> : activeConversation.isGroup ? `${activeConversation.participants.length} members` : (activeConversation.user?.is_online ? 'online' : 'offline')}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-1 sm:space-x-2 text-[#54656f] dark:text-[#aebac1] shrink-0">
                  {!activeConversation.isGroup && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => initiateCall(activeConversation.user.id, true)}><Video className="h-5 w-5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => initiateCall(activeConversation.user.id, false)}><Phone className="h-5 w-5" /></Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-2 z-10">
                {messages.map((msg, idx) => {
                  const isMe = msg.sender_id === user?.id;
                  
                  return (
                    <div key={msg.id || idx} className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`} ref={(el) => { if (el && !isMe && msg.status !== 'read' && observer.current) { observer.current.observe(el); } }} data-message-id={msg.id} data-sender-id={msg.sender_id} data-status={msg.status}>
                      <div className="flex items-start max-w-[85%] sm:max-w-[65%] relative">
                        
                        {/* Hover Reply Button */}
                        <button onClick={() => setReplyingTo(msg)} className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 p-2 text-[#8696a0] hover:text-[#54656f] dark:hover:text-[#aebac1] ${isMe ? '-left-10' : '-right-10'}`}>
                          <Reply className="h-4 w-4" />
                        </button>

                        <div className={`rounded-lg px-2 py-1.5 shadow-sm text-[14.2px] text-[#111b21] dark:text-[#e9edef] ${isMe ? 'bg-[#d9fdd3] dark:bg-[#005c4b] rounded-tr-none' : 'bg-white dark:bg-[#202c33] rounded-tl-none'} transition-colors duration-200`}>
                          
                          {/* Render Reply Context inside bubble */}
                          {msg.type === 'reply' && (
                            <div className="bg-black/5 dark:bg-black/20 rounded cursor-pointer p-2 mb-1 border-l-4 border-[#00a884] flex flex-col">
                               <span className="text-[12px] font-semibold text-[#00a884]">{JSON.parse(msg.content).originalSender}</span>
                               <span className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">{JSON.parse(msg.content).originalText}</span>
                            </div>
                          )}

                          {/* Message Content */}
                          <div className="flex flex-col relative min-w-[70px]">
                             {msg.type === 'image' ? <img src={msg.content} className="max-w-[250px] rounded mb-1" /> : msg.type === 'reply' ? <span className="pb-3 pr-14 break-words">{JSON.parse(msg.content).text}</span> : <span className="pb-3 pr-14 break-words">{msg.content}</span>}
                             
                             {/* Timestamps and Ticks */}
                             <div className="absolute bottom-[-2px] right-0 flex items-center text-[10px] text-[#667781] dark:text-[#8696a0]">
                               <span>{format(new Date(msg.timestamp), 'HH:mm')}</span>
                               {isMe && (
                                 <span className="ml-1">
                                   {msg.status === 'read' ? <CheckCheck className="h-[14px] w-[14px] text-[#53bdeb]" /> : msg.status === 'delivered' ? <CheckCheck className="h-[14px] w-[14px]" /> : <Check className="h-[14px] w-[14px]" />}
                                 </span>
                               )}
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input Area */}
              <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-2 sm:px-4 py-2 sm:py-3 z-10 flex flex-col border-t border-[#d1d7db] dark:border-[#222d34] transition-colors duration-200 shrink-0">
                {/* Replying Preview Box */}
                {replyingTo && (
                  <div className="bg-[#f0f2f5] dark:bg-[#202c33] mb-2 px-2 flex transition-colors duration-200">
                     <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg p-3 border-l-4 border-[#00a884] relative">
                       <button type="button" onClick={() => setReplyingTo(null)} className="absolute top-2 right-2 text-[#8696a0]"><X className="h-4 w-4" /></button>
                       <p className="text-[13px] font-semibold text-[#00a884]">{replyingTo.sender_id === user?.id ? 'You' : 'User'}</p>
                       <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate pr-8">{replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'reply' ? JSON.parse(replyingTo.content).text : replyingTo.content}</p>
                     </div>
                  </div>
                )}
                
                <form onSubmit={sendMessage} className="flex items-center space-x-1 sm:space-x-3">
                  <Button type="button" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0] shrink-0"><Paperclip className="h-6 w-6" /></Button>
                  <div className="relative shrink-0">
                    <Button type="button" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0]"><ImageIcon className="h-6 w-6" /></Button>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 cursor-pointer opacity-0" />
                  </div>
                  <Input value={newMessage} onChange={handleTyping} placeholder="Type a message" className="flex-1 rounded-lg bg-white dark:bg-[#2a3942] border-none py-3 px-4 shadow-sm focus-visible:ring-0 text-[15px] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#8696a0]" />
                  <Button type="submit" variant="ghost" size="icon" className="text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884] dark:hover:text-[#00a884] shrink-0">
                    {newMessage.trim() ? <Send className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                  </Button>
                </form>
              </div>
            </>
          ) : (
            // EMPTY STATE (Only visible on Desktop when no chat is active)
            <div className="flex h-full flex-col items-center justify-center border-b-[6px] border-[#25d366] z-10 bg-[#f0f2f5] dark:bg-[#222d34] w-full transition-colors duration-200">
               <div className="text-center flex flex-col items-center">
                  <div className="mb-8 w-80 h-44 flex items-center justify-center">
                     <div className="relative flex items-center justify-center w-full h-full bg-[#e3e6e8] dark:bg-[#2a3942] rounded-full px-12 transition-colors duration-200">
                         <Laptop className="h-20 w-20 text-[#8696a0] z-10" strokeWidth={1} />
                         <Smartphone className="h-14 w-14 text-[#00a884] absolute right-16 bottom-6 z-20 bg-[#f0f2f5] dark:bg-[#222d34] rounded-lg p-1 transition-colors duration-200" strokeWidth={1.5} />
                     </div>
                  </div>
                  <h1 className="text-[32px] font-light text-[#41525d] dark:text-[#e9edef] mb-4 transition-colors duration-200">MedLine for Web</h1>
                  <p className="text-[#667781] dark:text-[#8696a0] text-[14px] leading-relaxed mb-10 max-w-md transition-colors duration-200">Send and receive messages without keeping your phone online.<br/>Use MedLine on up to 4 linked devices and 1 phone at the same time.</p>
               </div>
               <div className="absolute bottom-10 flex items-center space-x-1.5 text-[#8696a0] text-[13px]">
                 <Lock className="h-3 w-3" />
                 <span>End-to-end encrypted</span>
               </div>
            </div>
          )}
        </div>

        {/* CALL UI OVERLAY */}
        {(incomingCall || currentCall) && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white">
            {incomingCall && !currentCall && (
              <div className="flex flex-col items-center space-y-8">
                <div className="h-32 w-32 overflow-hidden rounded-full bg-slate-800">
                  <UserIcon className="h-full w-full p-6 text-slate-500" />
                </div>
                <h2 className="text-2xl font-semibold">Incoming Call...</h2>
                <div className="flex space-x-6">
                  <Button onClick={answerCall} className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600"><Phone className="h-8 w-8" /></Button>
                  <Button onClick={rejectCall} className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600"><Phone className="h-8 w-8 rotate-[135deg]" /></Button>
                </div>
              </div>
            )}
            {currentCall && (
              <div className="relative h-full w-full">
                {isVideo && (
                  <>
                    <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                    <video ref={localVideoRef} autoPlay playsInline muted className={`absolute bottom-8 right-8 h-48 w-32 rounded-xl object-cover shadow-2xl border-2 border-white/20 transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                  </>
                )}
                {!isVideo && (
                  <div className="flex h-full flex-col items-center justify-center space-y-8">
                    <div className="h-32 w-32 overflow-hidden rounded-full bg-slate-800"><UserIcon className="h-full w-full p-6 text-slate-500" /></div>
                    <h2 className="text-2xl font-semibold">{remoteStream ? 'In Call' : 'Calling...'}</h2>
                    <p className="text-slate-400 font-mono text-xl">{remoteStream ? formatDuration(callDuration) : 'Connecting...'}</p>
                  </div>
                )}
                <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 space-x-6 z-10">
                  <Button onClick={toggleMute} className={`h-16 w-16 rounded-full transition-colors ${isMuted ? 'bg-red-500' : 'bg-slate-600'}`}>{isMuted ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}</Button>
                  {isVideo && <Button onClick={toggleVideo} className={`h-16 w-16 rounded-full transition-colors ${isVideoOff ? 'bg-red-500' : 'bg-slate-600'}`}>{isVideoOff ? <VideoOff className="h-8 w-8 text-white" /> : <Video className="h-8 w-8 text-white" />}</Button>}
                  <Button onClick={() => setShowEndCallConfirm(true)} className="h-16 w-16 rounded-full bg-red-500"><Phone className="h-8 w-8 rotate-[135deg] text-white" /></Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODALS */}
        {showNewChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111b21] p-6 shadow-xl">
              <h2 className="text-xl font-bold text-[#111b21] dark:text-[#e9edef] mb-4">Start New Chat</h2>
              <form onSubmit={handleStartNewChat} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#667781] dark:text-[#8696a0] mb-1">User's Phone Number</label>
                  <div className="flex w-full border border-[#d1d7db] dark:border-[#222d34] rounded-md bg-transparent px-3 py-2 focus-within:ring-2 focus-within:ring-[#00a884] transition-colors">
                    <PhoneInput international defaultCountry="AE" placeholder="Enter phone number" value={searchPhone} onChange={(val) => setSearchPhone(val || '')} className="w-full text-sm outline-none bg-transparent text-[#111b21] dark:text-[#e9edef]" inputComponent={Input} style={{ border: 'none', boxShadow: 'none' }} />
                  </div>
                  {searchError && <p className="text-red-500 text-xs mt-2">{searchError}</p>}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <Button variant="ghost" type="button" onClick={() => { setShowNewChat(false); setSearchError(''); setSearchPhone(''); }} className="text-[#54656f] dark:text-[#8696a0]">Cancel</Button>
                  <Button type="submit" disabled={!searchPhone} className="bg-[#00a884] hover:bg-[#058b6e] text-white">Find & Chat</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCreateGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111b21] p-6 shadow-xl">
              <h2 className="text-xl font-bold text-[#111b21] dark:text-[#e9edef] mb-4">Create New Group</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#667781] dark:text-[#8696a0] mb-1">Group Name</label>
                  <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Enter group name..." className="w-full bg-transparent text-[#111b21] dark:text-[#e9edef] border-[#d1d7db] dark:border-[#222d34] focus-visible:ring-[#00a884]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#667781] dark:text-[#8696a0] mb-2">Select Participants</label>
                  <div className="max-h-60 overflow-y-auto border border-[#d1d7db] dark:border-[#222d34] rounded-lg divide-y divide-[#f2f2f2] dark:divide-[#222d34]">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] cursor-pointer" onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}>
                        <div className="relative h-10 w-10 shrink-0 mr-3">
                          <div className="h-full w-full overflow-hidden rounded-full bg-[#dfe5e7] dark:bg-[#54656f]">
                            {u.avatar_url ? <img src={u.avatar_url} alt={u.name} className="h-full w-full object-cover" /> : <UserIcon className="h-full w-full p-2 text-white" />}
                          </div>
                        </div>
                        <div className="flex-1"><h3 className="font-medium text-[#111b21] dark:text-[#e9edef]">{u.name}</h3></div>
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${selectedUsers.includes(u.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-[#d1d7db] dark:border-[#8696a0]'}`}>
                          {selectedUsers.includes(u.id) && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <Button variant="ghost" onClick={() => { setShowCreateGroup(false); setNewGroupName(''); setSelectedUsers([]); }} className="text-[#54656f] dark:text-[#8696a0]">Cancel</Button>
                <Button onClick={createGroup} disabled={!newGroupName.trim() || selectedUsers.length === 0} className="bg-[#00a884] hover:bg-[#058b6e] text-white">Create Group</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}