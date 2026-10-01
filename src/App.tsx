import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Pages
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import CreatePost from "./pages/CreatePost";
import PostDetail from "./pages/PostDetail";
import CampusServices from "./pages/CampusServices";
import Marketplace from "./pages/Marketplace";
import CreateListing from "./pages/CreateListing";
import ListingDetail from "./pages/ListingDetail";
import StudentList from "./pages/StudentList";
import Predictions from "./pages/Predictions";
import CreatePrediction from "./pages/CreatePrediction";
import Game from "./pages/Game";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Groups from "./pages/Groups";
import CreateGroup from "./pages/CreateGroup";
import GroupDetail from "./pages/GroupDetail";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminRules from "./pages/admin/AdminRules";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminSponsoredPrivileges from "./pages/admin/AdminSponsoredPrivileges";
import AdminPredictionParticipants from "./pages/admin/AdminPredictionParticipants";
import AdminUserBans from "./pages/admin/AdminUserBans";
import AdminAnnouncements from "./pages/admin/AdminAnnouncements";
import AdminContact from "./pages/admin/AdminContact";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminAudio from "./pages/admin/AdminAudio";

import Announcements from "./pages/Announcements";
import { AudioAutoPlay } from "./components/AudioAutoPlay";
import Contact from "./pages/Contact";
import Notifications from "./pages/Notifications";
import ChatList from "./pages/ChatList";
import PrivateChat from "./pages/PrivateChat";
import InviteFriends from "./pages/InviteFriends";
import AdminAds from "./pages/admin/AdminAds";
import AdminRewards from "./pages/admin/AdminRewards";
import Rewards from "./pages/Rewards";
import Withdraw from "./pages/Withdraw";
import AdminWithdrawals from "./pages/admin/AdminWithdrawals";
import AdminAdLibrary from "./pages/admin/AdminAdLibrary";
import AdminVideoTasks from "./pages/admin/AdminVideoTasks";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
      <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
      <Route path="/post/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><CampusServices /></ProtectedRoute>} />
      <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
      <Route path="/listing/:listingId" element={<ProtectedRoute><ListingDetail /></ProtectedRoute>} />
      <Route path="/create-listing" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><StudentList /></ProtectedRoute>} />
      <Route path="/predictions" element={<ProtectedRoute><Predictions /></ProtectedRoute>} />
      <Route path="/predictions/create" element={<ProtectedRoute><CreatePrediction /></ProtectedRoute>} />
      <Route path="/game" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/invite" element={<ProtectedRoute><InviteFriends /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
      <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
      
      {/* Groups */}
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/groups/create" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute><AdminApprovals /></ProtectedRoute>} />
      <Route path="/admin/rules" element={<ProtectedRoute><AdminRules /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute><AdminStudents /></ProtectedRoute>} />
      <Route path="/admin/sponsored" element={<ProtectedRoute><AdminSponsoredPrivileges /></ProtectedRoute>} />
      <Route path="/admin/predictions" element={<ProtectedRoute><AdminPredictionParticipants /></ProtectedRoute>} />
      <Route path="/admin/bans" element={<ProtectedRoute><AdminUserBans /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/contact" element={<ProtectedRoute><AdminContact /></ProtectedRoute>} />
      <Route path="/admin/broadcast" element={<ProtectedRoute><AdminBroadcast /></ProtectedRoute>} />
      <Route path="/admin/audio" element={<ProtectedRoute><AdminAudio /></ProtectedRoute>} />
      <Route path="/admin/ads" element={<ProtectedRoute><AdminAds /></ProtectedRoute>} />
      <Route path="/admin/rewards" element={<ProtectedRoute><AdminRewards /></ProtectedRoute>} />
      <Route path="/admin/withdrawals" element={<ProtectedRoute><AdminWithdrawals /></ProtectedRoute>} />
      <Route path="/admin/ad-library" element={<ProtectedRoute><AdminAdLibrary /></ProtectedRoute>} />
      <Route path="/admin/video-tasks" element={<ProtectedRoute><AdminVideoTasks /></ProtectedRoute>} />
      
      {/* Public pages */}
      <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
      <Route path="/contact" element={<ProtectedRoute><Contact /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/chats" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
      <Route path="/chat" element={<Navigate to="/chats" replace />} />
      <Route path="/chat/private/:recipientId" element={<ProtectedRoute><PrivateChat /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <AudioAutoPlay />
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
