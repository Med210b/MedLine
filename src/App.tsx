import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { CallProvider } from '@/src/contexts/CallContext';
import { SettingsProvider } from '@/src/contexts/SettingsContext';
import { PresenceManager } from '@/src/components/PresenceManager';
import Auth from '@/src/pages/Auth';
import ProfileSetup from '@/src/pages/ProfileSetup';
import Chat from '@/src/pages/Chat';
import Settings from '@/src/pages/Settings';
import { useNotifications } from '@/src/hooks/useNotifications';
import { usePushNotifications } from '@/src/hooks/usePushNotifications'; // <-- ADDED THIS

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vydtnkweietlfvjhbdhv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5ZHRua3dlaWV0bGZ2amhiZGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MjY4ODIsImV4cCI6MjA4OTUwMjg4Mn0.hJII6DG0BmFgc8i7cE5BLwFheHGSYRb7WrOSbLIz9Zc';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" />;
  return <>{children}</>;
}

function AppContent() {
  useNotifications();
  usePushNotifications(); // <-- ADDED THIS to activate Capacitor push notifications

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/chat" />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Supabase Configuration Required</h1>
          <p className="text-slate-600 mb-6">
            Please add the following secrets in the AI Studio settings (⚙️ gear icon, top-right corner):
          </p>
          <ul className="text-left text-sm text-slate-700 bg-slate-100 p-4 rounded-lg mb-6 space-y-2 font-mono">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="text-sm text-slate-500">
            The app will automatically reload once the secrets are added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        {/* PresenceManager runs silently in the background managing online status */}
        <PresenceManager />
        <CallProvider>
          <AppContent />
        </CallProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}