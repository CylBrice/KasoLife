import { useState } from 'react';
import { Users, RefreshCw, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatMessage {
  id: string;
  pseudo: string;
  text?: string;
  amount_xcon?: number;
  kind: 'chat' | 'gift';
}

interface User {
  id: string;
  pseudo: string;
  gender?: 'M' | 'F' | 'Other';
}

interface LiveChatTabsProps {
  messages: ChatMessage[];
  viewers: User[];
  onRefreshUsers?: () => void;
  isLoadingUsers?: boolean;
  onSendChat?: (text: string) => void;
  isSendingChat?: boolean;
}

type TabType = 'chat' | 'mp' | 'fans';

export function LiveChatTabs({
  messages,
  viewers,
  onRefreshUsers,
  isLoadingUsers = false,
  onSendChat,
  isSendingChat = false,
}: LiveChatTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [chatInput, setChatInput] = useState('');

  const genderDisplay = (gender?: string) => {
    switch (gender) {
      case 'M':
        return <span className="text-blue-400">♂ M</span>;
      case 'F':
        return <span className="text-pink-400">♀ F</span>;
      default:
        return <span className="text-sage-muted">•</span>;
    }
  };

  const handleSendChat = () => {
    if (chatInput.trim() && onSendChat) {
      onSendChat(chatInput);
      setChatInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-ink-surface rounded-xl border border-ink-line">
      {/* Tabs Header */}
      <div className="flex gap-2 border-b border-ink-line p-3 items-center">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'bg-brick/20 text-brick'
              : 'text-sage hover:bg-ink-raised'
          }`}
        >
          <MessageSquare className="inline h-4 w-4 mr-1" />
          Chat
        </button>

        <button
          onClick={() => setActiveTab('mp')}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'mp'
              ? 'bg-brick/20 text-brick'
              : 'text-sage hover:bg-ink-raised'
          }`}
        >
          <MessageSquare className="inline h-4 w-4 mr-1" />
          M.P.
        </button>

        <button
          onClick={() => setActiveTab('fans')}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'fans'
              ? 'bg-brick/20 text-brick'
              : 'text-sage hover:bg-ink-raised'
          }`}
        >
          <Users className="inline h-4 w-4 mr-1" />
          Fans ({viewers.length})
        </button>

        <Button
          size="sm"
          variant="outline"
          onClick={onRefreshUsers}
          disabled={isLoadingUsers}
          className="ml-auto h-8 rounded-xl"
        >
          <RefreshCw className={`h-3 w-3 ${isLoadingUsers ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Messages Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'chat' && (
          <div className="space-y-2 h-full flex flex-col">
            {messages.length === 0 ? (
              <p className="text-xs text-sage-muted text-center py-4">Aucun message</p>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className="text-xs">
                    {msg.kind === 'chat' ? (
                      <p>
                        <span className="font-medium text-cream">{msg.pseudo}:</span>
                        <span className="text-sage-muted ml-1">{msg.text}</span>
                      </p>
                    ) : (
                      <p className="text-gold">
                        <span className="font-medium">{msg.pseudo}</span>
                        <span> a envoyé un cadeau de {msg.amount_xcon} XCON</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'mp' && (
          <p className="text-xs text-sage-muted text-center py-4">
            Aucun message privé
          </p>
        )}

        {activeTab === 'fans' && (
          <div className="space-y-1">
            {viewers.length === 0 ? (
              <p className="text-xs text-sage-muted text-center py-4">Aucun spectateur</p>
            ) : (
              viewers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-ink-raised/50 text-xs"
                >
                  <span className="text-cream truncate flex-1">{user.pseudo}</span>
                  <span>{genderDisplay(user.gender)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Chat Input (only visible on Chat tab) */}
      {activeTab === 'chat' && (
        <div className="border-t border-ink-line p-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => {
              if (e.target.value.length <= 120) {
                setChatInput(e.target.value);
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Message (120 max)…"
            maxLength={120}
            className="flex-1 rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:outline-none focus:ring-2 focus:ring-brick/50"
          />
          <Button
            size="icon"
            onClick={handleSendChat}
            disabled={!chatInput.trim() || isSendingChat}
            className="rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
