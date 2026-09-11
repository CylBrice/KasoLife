"use client";

import { useState } from "react";
import { FileText, ShoppingBag, Video } from "lucide-react";
import Image from "next/image";

interface Creator {
  id: string;
  pseudo: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
}

interface Album {
  id: string;
  title: string;
  type: "PHOTO" | "VIDEO";
  cover_url?: string;
  price_xcon: number;
  items_count: number;
}

interface CreatorInfoTabsProps {
  creator: Creator;
  albums?: Album[];
}

type TabType = "bio" | "marketplace" | "castream";

export function CreatorInfoTabs({ creator, albums = [] }: CreatorInfoTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("bio");

  return (
    <div className="flex flex-col h-full bg-ink-surface rounded-xl border border-ink-line">
      {/* Tabs Header */}
      <div className="flex gap-2 border-b border-ink-line p-3">
        <button
          onClick={() => setActiveTab("bio")}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "bio"
              ? "bg-brick/20 text-brick"
              : "text-sage hover:bg-ink-raised"
          }`}
        >
          <FileText className="inline h-4 w-4 mr-1" />
          Bio
        </button>

        <button
          onClick={() => setActiveTab("marketplace")}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "marketplace"
              ? "bg-brick/20 text-brick"
              : "text-sage hover:bg-ink-raised"
          }`}
        >
          <ShoppingBag className="inline h-4 w-4 mr-1" />
          Marketplace
        </button>

        <button
          onClick={() => setActiveTab("castream")}
          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === "castream"
              ? "bg-brick/20 text-brick"
              : "text-sage hover:bg-ink-raised"
          }`}
        >
          <Video className="inline h-4 w-4 mr-1" />
          Castream
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "bio" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brick/20 flex items-center justify-center shrink-0 overflow-hidden">
                {creator.avatar_url ? (
                  <Image src={creator.avatar_url} alt={creator.pseudo} fill className="object-cover" />
                ) : (
                  <span className="text-cream font-display">{creator.display_name?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-cream">{creator.display_name}</p>
                <p className="text-xs text-sage-muted">@{creator.pseudo}</p>
              </div>
            </div>
            {creator.bio && <p className="text-xs text-cream leading-relaxed">{creator.bio}</p>}
          </div>
        )}

        {activeTab === "marketplace" && (
          <div className="grid grid-cols-2 gap-2">
            {albums.length === 0 ? (
              <p className="col-span-2 text-xs text-sage-muted text-center py-4">Aucun album</p>
            ) : (
              albums.map((album) => (
                <div
                  key={album.id}
                  className="rounded-lg border border-ink-line bg-ink-raised/50 overflow-hidden hover:border-brick/50 transition-colors cursor-pointer"
                >
                  {album.cover_url ? (
                    <div className="relative aspect-square">
                      <Image src={album.cover_url} alt={album.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        {album.type === "VIDEO" ? (
                          <Video className="h-6 w-6 text-cream" />
                        ) : (
                          <FileText className="h-6 w-6 text-cream" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-emerald/30 to-gold/20 flex items-center justify-center">
                      {album.type === "VIDEO" ? (
                        <Video className="h-6 w-6 text-sage-muted" />
                      ) : (
                        <FileText className="h-6 w-6 text-sage-muted" />
                      )}
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium text-cream truncate">{album.title}</p>
                    <p className="text-xs text-gold">{album.price_xcon} XCON</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "castream" && (
          <p className="text-xs text-sage-muted text-center py-4">Castream — Replay bientôt disponible</p>
        )}
      </div>
    </div>
  );
}
