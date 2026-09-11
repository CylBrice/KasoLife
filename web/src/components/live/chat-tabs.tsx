import { useState } from 'react';
import { Users, RefreshCw, MessageSquare } from 'lucide-react';
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
  avatar_url?: string;
}

interface LiveChatTabsProps {
  messages: ChatMessage[];
  viewers: User[];
  onRefreshUsers?: () => void;
  isLoadingUsers?: boolean;
}

type TabType = 'chat' | 'mp' | 'fans';

export function LiveChatTabs({
  messages,
  viewers,
  onRefreshUsers,
  isLoadingUsers = false,
}: LiveChatTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

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

  return (
    <div className="flex flex-col h-full bg-ink-surface rounded-xl border border-ink-line">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-ink-line p-3">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'fans'
              ? 'bg-brick/20 text-brick'
              : 'text-sage hover:bg-ink-raised'
          }`}
        >
          <Users className="inline h-4 w-4 mr-1" />
          Fans ({viewers.length})
        </button>

        {activeTab === 'fans' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefreshUsers}
            disabled={isLoadingUsers}
            className="ml-auto h-8"
          >
            <RefreshCw className={`h-3 w-3 ${isLoadingUsers ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'chat' && (
          <div className="space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-sage-muted text-center py-4">Aucun message</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-xs">
                  {msg.kind === 'chat' ? (
                    <p>
                      <span className="font-medium text-cream">{msg.pseudo}:</span>
                      <span className="text-sage-muted ml-1">{msg.text}</span>
                    </p>
                  ) : (
                    <p className="text-brick">
                      <span className="font-medium">{msg.pseudo}</span>
                      <span> a envoyé un cadeau de {msg.amount_xcon} XAF</span>
                    </p>
                  )}
                </div>
              ))
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
                  <div className="w-6 h-6 rounded-full bg-brick/20 flex items-center justify-center shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.pseudo} className="w-full h-full rounded-full" />
                    ) : (
                      <span className="text-sage-muted">•</span>
                    )}
                  </div>
                  <span className="text-cream truncate flex-1">{user.pseudo}</span>
                  <span>{genderDisplay(user.gender)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
