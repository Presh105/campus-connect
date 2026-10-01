import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Paperclip, FileText, Ban } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/ImageUpload';
import { useBanCheck } from '@/hooks/useBanCheck';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
}

interface OtherUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  is_anonymous: boolean;
}

export default function PrivateChat() {
  const { recipientId } = useParams<{ recipientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isBanned: isChatBanned, loading: chatBanLoading } = useBanCheck('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ url: string; type: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    if (!user || !recipientId) return;
    
    // Prevent self-messaging
    if (user.id === recipientId) {
      toast.error('You cannot message yourself');
      navigate(-1);
      return;
    }

    if (!chatBanLoading && isChatBanned) {
      toast.error('You are banned from private messaging');
      navigate('/chat');
      return;
    }

    checkBlockStatus();
    fetchOtherUser();
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`private-${[user.id, recipientId].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'private_messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === recipientId) ||
            (newMsg.sender_id === recipientId && newMsg.receiver_id === user.id)
          ) {
            setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
            if (newMsg.sender_id === recipientId) {
              supabase.rpc('mark_chat_read' as any, { _other_user: recipientId });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, recipientId]);

  const checkBlockStatus = async () => {
    if (!user || !recipientId) return;
    
    // Check if I blocked them
    const { data: blocked } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', recipientId)
      .single();
    
    setIsBlocked(!!blocked);
    
    // Check if they blocked me
    const { data: blockedMe } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', recipientId)
      .eq('blocked_id', user.id)
      .single();
    
    setHasBlockedMe(!!blockedMe);
  };

  const handleBlock = async () => {
    if (!user || !recipientId) return;
    setBlockLoading(true);
    
    const { error } = await supabase.from('user_blocks').insert({
      blocker_id: user.id,
      blocked_id: recipientId,
    });
    
    if (error) {
      toast.error('Failed to block user');
    } else {
      toast.success('User blocked permanently');
      setIsBlocked(true);
    }
    setBlockLoading(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchOtherUser = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, is_anonymous')
      .eq('user_id', recipientId)
      .single();

    if (!error && data) {
      setOtherUser(data);
    }
  };

  const fetchMessages = async () => {
    if (!user || !recipientId) return;

    const { data, error } = await supabase
      .from('private_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
      supabase.rpc('mark_chat_read' as any, { _other_user: recipientId });
    }
    setLoading(false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recipientId || (!newMessage.trim() && !pendingFile)) return;

    const { error } = await supabase.from('private_messages').insert({
      sender_id: user.id,
      receiver_id: recipientId,
      content: newMessage.trim() || (pendingFile ? 'Sent a file' : ''),
      file_url: pendingFile?.url || null,
      file_type: pendingFile?.type || null,
    });

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      setPendingFile(null);
      setShowFileUpload(false);
    }
  };

  const handleFileUpload = (url: string, fileType?: string) => {
    if (url) {
      setPendingFile({ url, type: fileType || 'file' });
    } else {
      setPendingFile(null);
    }
  };

  const displayName = otherUser?.is_anonymous ? 'Anonymous Member' : otherUser?.full_name || 'Member';

  return (
    <div className="min-h-screen bg-background no-screenshot">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">{displayName}</h1>
            <p className="text-xs text-muted-foreground">Private conversation</p>
          </div>
        </div>
        {!isBlocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Ban className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Block this user permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. You will no longer be able to send or receive messages from this user.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBlock} disabled={blockLoading}>
                  {blockLoading ? 'Blocking...' : 'Block Permanently'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="px-4 py-4">
        <Card className="shadow-soft overflow-hidden">
          <div className="h-[calc(100vh-200px)] flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 animate-in fade-in duration-300 ${
                        isOwn ? 'flex-row-reverse slide-in-from-right-4' : 'slide-in-from-left-4'
                      }`}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        {isOwn ? (
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            You
                          </AvatarFallback>
                        ) : (
                          <>
                            <AvatarImage src={otherUser?.avatar_url || undefined} />
                            <AvatarFallback className="bg-muted">
                              {displayName.charAt(0)}
                            </AvatarFallback>
                          </>
                        )}
                      </Avatar>
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-2xl px-4 py-2 transition-transform active:scale-[0.98] ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-tr-sm'
                              : 'bg-muted rounded-tl-sm'
                          }`}
                        >
                          {msg.file_url && (
                            <div className="mb-2">
                              {msg.file_type === 'image' ? (
                                <img 
                                  src={msg.file_url} 
                                  alt="Shared" 
                                  className="rounded-lg max-w-full animate-in zoom-in-95 duration-300"
                                />
                              ) : (
                                <a 
                                  href={msg.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-background/20 rounded-lg"
                                >
                                  <FileText className="w-5 h-5" />
                                  <span className="text-sm underline">View file</span>
                                </a>
                              )}
                            </div>
                          )}
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 px-2">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Blocked Status */}
            {(isBlocked || hasBlockedMe) && (
              <div className="px-4 py-3 bg-destructive/10 text-center">
                <p className="text-sm text-destructive font-medium">
                  {isBlocked ? 'You have blocked this user' : 'You cannot message this user'}
                </p>
              </div>
            )}

            {/* File Upload Preview */}
            {showFileUpload && user && !isBlocked && !hasBlockedMe && (
              <div className="px-3 pt-3 border-t border-border">
                <ImageUpload
                  bucket="chat-files"
                  userId={user.id}
                  onUpload={handleFileUpload}
                  allowFiles
                />
              </div>
            )}

            {/* Input */}
            <form onSubmit={sendMessage} className={`p-3 border-t border-border ${(isBlocked || hasBlockedMe) ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-full shrink-0"
                  onClick={() => setShowFileUpload(!showFileUpload)}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  maxLength={5000}
                  className="rounded-full"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() && !pendingFile}
                  className="rounded-full shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
                        }
