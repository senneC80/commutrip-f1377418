import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Conversation {
  userId: string;
  name: string;
  lastMessage: string;
  lastAt: string;
  unread: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations
  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Group by other user
    const convMap = new Map<string, { msgs: Message[] }>();
    data.forEach((msg: Message) => {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(otherId)) convMap.set(otherId, { msgs: [] });
      convMap.get(otherId)!.msgs.push(msg);
    });

    // Fetch names
    const otherIds = [...convMap.keys()];
    const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', otherIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach(p => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim(); });

    const convs: Conversation[] = otherIds.map(uid => {
      const msgs = convMap.get(uid)!.msgs;
      const last = msgs[0];
      return {
        userId: uid,
        name: nameMap[uid] || 'Unknown',
        lastMessage: last.content,
        lastAt: last.created_at,
        unread: msgs.some(m => m.receiver_id === user.id && !m.is_read),
      };
    }).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

    setConversations(convs);
    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, [user]);

  // Fetch messages for selected conversation
  const openConversation = async (otherId: string) => {
    if (!user) return;
    setSelectedUserId(otherId);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);

    // Mark unread messages as read
    const unreadIds = (data || []).filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      setConversations(prev => prev.map(c => c.userId === otherId ? { ...c, unread: false } : c));
    }

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async () => {
    if (!user || !selectedUserId || !newMessage.trim()) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: newMessage.trim(),
    }).select().single();

    if (!error && data) {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
      // Update conversation list
      setConversations(prev => {
        const existing = prev.find(c => c.userId === selectedUserId);
        if (existing) {
          return prev.map(c => c.userId === selectedUserId ? { ...c, lastMessage: data.content, lastAt: data.created_at } : c)
            .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        }
        return prev;
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setSending(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const selectedConv = conversations.find(c => c.userId === selectedUserId);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-4">Messages</h1>
      <Card className="shadow-card overflow-hidden">
        <div className="flex h-[calc(100vh-220px)] min-h-[400px]">
          {/* Conversations list */}
          <div className={cn(
            "w-full md:w-80 border-r flex flex-col",
            selectedUserId ? "hidden md:flex" : "flex"
          )}>
            <ScrollArea className="flex-1">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No conversations yet.</p>
                </div>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.userId}
                    onClick={() => openConversation(c.userId)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                      selectedUserId === c.userId && "bg-muted",
                      c.unread && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={cn("font-medium text-sm", c.unread && "font-bold")}>{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(c.lastAt), 'MMM d')}</span>
                    </div>
                    <p className={cn("text-xs truncate", c.unread ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {c.lastMessage}
                    </p>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Message thread */}
          <div className={cn(
            "flex-1 flex flex-col",
            !selectedUserId ? "hidden md:flex" : "flex"
          )}>
            {!selectedUserId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedUserId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium">{selectedConv?.name}</span>
                </div>
                <ScrollArea className="flex-1 px-4 py-3">
                  <div className="space-y-3">
                    {messages.map(m => (
                      <div key={m.id} className={cn("flex", m.sender_id === user!.id ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
                          m.sender_id === user!.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}>
                          <p>{m.content}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            m.sender_id === user!.id ? "text-primary-foreground/60" : "text-muted-foreground"
                          )}>
                            {format(new Date(m.created_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </ScrollArea>
                <div className="px-4 py-3 border-t flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message…"
                    className="min-h-[40px] max-h-24 resize-none"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  />
                  <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
