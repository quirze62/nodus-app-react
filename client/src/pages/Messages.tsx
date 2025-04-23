import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNostr } from '@/hooks/useNostr';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { NostrEvent, NostrProfile } from '@/lib/nostr';
import { formatDate } from '@/lib/utils';
import { useOffline } from '@/hooks/useOffline';
import { Loader2, Send } from 'lucide-react';

interface Conversation {
  pubkey: string;
  profile?: NostrProfile & { pubkey: string };
  lastMessage?: NostrEvent;
  unread: number;
}

export default function Messages() {
  const { user } = useAuth();
  const { getMessages, sendMessage, getProfile } = useNostr();
  const { isOffline } = useOffline();
  const { toast } = useToast();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<NostrEvent[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sample conversations for the UI - in a real app, this would come from the API
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true);
      
      // In a real app, this would fetch actual conversations from a relay
      // For this demo, we'll create some sample conversations
      const samplePubkeys = [
        '7f38a193cbd70c7e00348493e5d0f6d8b60d9c5d8f3b425f99d473d414f64142',
        '44bf04f1d601b73838d24547995db83de9249312e72640bd2e13f3edb42b6c4e',
        'a7e3794cef7fb509a7e0b7911952161f3dbdafce6bc699dc9428c638d09e1fb3'
      ];
      
      try {
        const conversationsPromises = samplePubkeys.map(async (pubkey) => {
          const profile = await getProfile(pubkey);
          // Simulate some messages
          const mockMessages = await getMessages(pubkey);
          const lastMessage = mockMessages.length > 0 
            ? mockMessages[mockMessages.length - 1] 
            : undefined;
          
          return {
            pubkey,
            profile,
            lastMessage,
            unread: Math.floor(Math.random() * 3)
          };
        });
        
        const loadedConversations = await Promise.all(conversationsPromises);
        setConversations(loadedConversations);
        
        // Select the first conversation by default
        if (loadedConversations.length > 0 && !selectedConversation) {
          setSelectedConversation(loadedConversations[0].pubkey);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
        toast({
          title: 'Error',
          description: 'Failed to load conversations',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user?.publicKey) {
      loadConversations();
    }
  }, [user, getProfile, getMessages, selectedConversation, toast]);
  
  // Load messages for the selected conversation
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation || !user?.publicKey) return;
      
      try {
        const messages = await getMessages(selectedConversation);
        setMessages(messages);
        
        // Mark conversation as read
        setConversations(prev => 
          prev.map(conv => 
            conv.pubkey === selectedConversation 
              ? { ...conv, unread: 0 } 
              : conv
          )
        );
      } catch (error) {
        console.error('Error loading messages:', error);
        toast({
          title: 'Error',
          description: 'Failed to load messages',
          variant: 'destructive'
        });
      }
    };
    
    loadMessages();
  }, [selectedConversation, user, getMessages, toast]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !selectedConversation || !user?.publicKey) return;
    
    setIsSending(true);
    
    try {
      const sentMessage = await sendMessage(selectedConversation, messageInput);
      
      if (sentMessage) {
        setMessages(prev => [...prev, sentMessage]);
        setMessageInput('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };
  
  const getSelectedProfile = () => {
    return conversations.find(conv => conv.pubkey === selectedConversation)?.profile;
  };
  
  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col md:flex-row">
      {/* Conversations list */}
      <div className="w-full md:w-64 md:border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-medium">Messages</h2>
        </div>
        
        {isLoading ? (
          <div className="p-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-500 dark:text-gray-400">No conversations yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {conversations.map(conversation => (
              <li 
                key={conversation.pubkey}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                  selectedConversation === conversation.pubkey 
                    ? 'bg-gray-100 dark:bg-gray-800' 
                    : ''
                }`}
                onClick={() => setSelectedConversation(conversation.pubkey)}
              >
                <div className="flex p-4">
                  <img 
                    src={conversation.profile?.picture || `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'women' : 'men'}/${Math.floor(Math.random() * 100)}.jpg`} 
                    alt="Avatar" 
                    className="h-10 w-10 rounded-full"
                  />
                  <div className="ml-3 overflow-hidden flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                        {conversation.profile?.name || `User ${conversation.pubkey.substring(0, 6)}`}
                      </p>
                      {conversation.unread > 0 && (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary">
                          <span className="text-xs font-medium text-white leading-none">
                            {conversation.unread}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {conversation.lastMessage?.content || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* Messages area */}
      <div className="flex-1 flex flex-col h-full">
        {selectedConversation ? (
          <>
            {/* Conversation header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
              <img 
                src={getSelectedProfile()?.picture || `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'women' : 'men'}/${Math.floor(Math.random() * 100)}.jpg`} 
                alt="Avatar" 
                className="h-8 w-8 rounded-full mr-3"
              />
              <div>
                <h2 className="text-md font-medium text-gray-900 dark:text-white">
                  {getSelectedProfile()?.name || `User ${selectedConversation.substring(0, 6)}`}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isOffline ? 'Offline' : 'Online'}
                </p>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                </div>
              ) : (
                messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.pubkey === user?.publicKey ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                        message.pubkey === user?.publicKey 
                          ? 'bg-primary text-white rounded-br-none' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs ${
                        message.pubkey === user?.publicKey 
                          ? 'text-primary-foreground opacity-70' 
                          : 'text-gray-500 dark:text-gray-400'
                      } text-right mt-1`}>
                        {formatDate(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message input */}
            <form 
              className="p-4 border-t border-gray-200 dark:border-gray-800 flex space-x-2"
              onSubmit={handleSendMessage}
            >
              <Input
                className="flex-1"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                disabled={isOffline || isSending}
              />
              <Button 
                type="submit" 
                disabled={!messageInput.trim() || isOffline || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">Send</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <Card className="max-w-md text-center p-6">
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Choose a conversation from the list to start messaging
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
