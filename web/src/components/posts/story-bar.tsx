'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Story {
  id: string;
  creator_id: string;
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  views_count: number;
  created_at: string;
  creator: { id: string; pseudo: string; avatar_url?: string };
}

interface StoryGroup {
  creator_id: string;
  creator: Story['creator'];
  stories: Story[];
  count: number;
}

interface StoryBarProps {
  isAuthenticated: boolean;
}

export function StoryBar({ isAuthenticated }: StoryBarProps) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStories = async () => {
      try {
        const res = await fetch('/api/stories/feed');
        if (!res.ok) throw new Error('Failed to fetch stories');
        const data = await res.json();
        setGroups(data || []);
      } catch (error) {
        console.error('Error fetching stories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
    const interval = setInterval(fetchStories, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated || loading || groups.length === 0) return null;

  const handleStoryClick = (group: StoryGroup) => {
    setSelectedStory(group.stories[0]);
    setCurrentIndex(0);
  };

  const handleNextStory = () => {
    const creator = selectedStory?.creator_id;
    const group = groups.find(g => g.creator_id === creator);
    if (!group) return;

    if (currentIndex < group.stories.length - 1) {
      setSelectedStory(group.stories[currentIndex + 1]);
      setCurrentIndex(currentIndex + 1);
    } else {
      setSelectedStory(null);
    }
  };

  const handlePrevStory = () => {
    if (currentIndex > 0) {
      const creator = selectedStory?.creator_id;
      const group = groups.find(g => g.creator_id === creator);
      if (group) {
        setSelectedStory(group.stories[currentIndex - 1]);
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  return (
    <>
      {/* Story Bar */}
      <div className="overflow-x-auto px-3 py-3 border-b border-ink-line flex gap-2 bg-ink-surface/50">
        {groups.map(group => (
          <button
            key={group.creator_id}
            onClick={() => handleStoryClick(group)}
            className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="relative h-14 w-14 rounded-full border-2 border-ink-line group-hover:border-coral transition overflow-hidden bg-ink-raised">
              {group.creator.avatar_url ? (
                <Image
                  src={group.creator.avatar_url}
                  alt={group.creator.pseudo}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gold">
                  {group.creator.pseudo[0].toUpperCase()}
                </div>
              )}
              {group.count > 1 && (
                <div className="absolute bottom-0 right-0 bg-coral text-cream text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {group.count}
                </div>
              )}
            </div>
            <p className="text-xs text-cream truncate max-w-14 text-center">
              {group.creator.pseudo}
            </p>
          </button>
        ))}
      </div>

      {/* Story Viewer Modal */}
      {selectedStory && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button
            onClick={() => setSelectedStory(null)}
            className="absolute top-4 right-4 z-10 text-white hover:text-cream transition"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-ink-line flex">
            {selectedStory.creator && (
              groups
                .find(g => g.creator_id === selectedStory.creator_id)
                ?.stories.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 transition-colors ${
                      i === currentIndex ? 'bg-coral' : 'bg-sage-muted'
                    }`}
                  />
                ))
            )}
          </div>

          {/* Creator info */}
          <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
            {selectedStory.creator?.avatar_url && (
              <Image
                src={selectedStory.creator.avatar_url}
                alt={selectedStory.creator.pseudo}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="text-white text-sm font-semibold">
              {selectedStory.creator?.pseudo}
            </span>
          </div>

          {/* Media */}
          <div className="relative w-full h-full max-w-md">
            {selectedStory.media_url.includes('video') || selectedStory.media_url.includes('.mp4') ? (
              <video
                src={selectedStory.media_url}
                autoPlay
                muted
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={selectedStory.media_url}
                alt="Story"
                fill
                className="object-cover"
                onClick={handleNextStory}
              />
            )}
          </div>

          {/* Caption */}
          {selectedStory.caption && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur px-3 py-2 rounded text-white text-sm">
              {selectedStory.caption}
            </div>
          )}

          {/* Navigation */}
          <button
            onClick={handlePrevStory}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-cream transition z-10 disabled:opacity-50"
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNextStory}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-cream transition z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
}
