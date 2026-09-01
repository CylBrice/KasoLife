// ============================================================
// KASOLIFE — Routes /stories v1.0
// CRUD stories : contenu éphémère 24h
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ── GET /stories/feed — stories des créateurs qu'on suit
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer les créateurs qu'on suit
    const { data: subscriptions } = await supabase.from('subscriptions')
      .select('creator_id')
      .eq('fan_id', userId)
      .eq('status', 'ACTIVE');

    const creatorIds = subscriptions?.map(s => s.creator_id) || [];
    if (creatorIds.length === 0) return res.json([]);

    // Récupérer les stories actives des créateurs qu'on suit
    const { data: stories, error } = await supabase.from('stories')
      .select(`
        id, creator_id, media_url, thumbnail_url, caption,
        views_count, expires_at, created_at,
        creator:users!stories_creator_id_fkey(id, pseudo, avatar_url)
      `)
      .in('creator_id', creatorIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Grouper par créateur (pour afficher une seule story bar par créateur)
    const storyMap = new Map();
    (stories || []).forEach(story => {
      if (!storyMap.has(story.creator_id)) {
        storyMap.set(story.creator_id, []);
      }
      storyMap.get(story.creator_id).push(story);
    });

    const grouped = Array.from(storyMap.entries()).map(([creatorId, creatorStories]) => ({
      creator_id: creatorId,
      creator: creatorStories[0]?.creator,
      stories: creatorStories,
      count: creatorStories.length,
    }));

    res.json(grouped);
  } catch (err) {
    console.error('GET /stories/feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /stories/:storyId — récupérer une story avec ses vues
router.get('/:storyId', authMiddleware, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Récupérer la story
    const { data: story, error } = await supabase.from('stories')
      .select(`
        id, creator_id, media_url, thumbnail_url, caption,
        access_level, price_xcon, views_count, expires_at, created_at,
        creator:users!stories_creator_id_fkey(id, pseudo, avatar_url)
      `)
      .eq('id', storyId)
      .eq('is_active', true)
      .single();

    if (error || !story) return res.status(404).json({ error: 'Story not found' });

    // Enregistrer la vue
    await supabase.from('story_views').insert({
      id: uuidv4(),
      story_id: storyId,
      user_id: userId,
    }).catch(() => {}); // Ignore duplicate view error

    res.json(story);
  } catch (err) {
    console.error('GET /stories/:storyId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /stories — créer une nouvelle story (créateur)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { media_url, thumbnail_url, caption, access_level, price_xcon } = req.body;
    const creatorId = req.user.id;

    // Valider que l'utilisateur est créateur
    const { data: user } = await supabase.from('users')
      .select('role').eq('id', creatorId).single();

    if (user?.role !== 'CREATOR') {
      return res.status(403).json({ error: 'Only creators can post stories' });
    }

    if (!media_url) return res.status(400).json({ error: 'media_url is required' });

    // Déterminer media_type depuis l'extension ou content-type
    const mediaType = media_url.includes('.mp4') || media_url.includes('video')
      ? 'VIDEO'
      : media_url.includes('.mp3') || media_url.includes('audio')
      ? 'AUDIO'
      : 'IMAGE';

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: story, error } = await supabase.from('stories').insert({
      id: uuidv4(),
      creator_id: creatorId,
      media_url,
      thumbnail_url: thumbnail_url || null,
      caption: caption || null,
      media_type: mediaType,
      access_level: access_level || 'SUBSCRIBERS',
      price_xcon: price_xcon || 0,
      expires_at: expiresAt,
    }).select().single();

    if (error) throw error;

    res.status(201).json({
      message: 'Story created',
      story,
      expires_in_hours: 24,
    });
  } catch (err) {
    console.error('POST /stories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /stories/:storyId — supprimer une story (créateur seulement)
router.delete('/:storyId', authMiddleware, async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Récupérer la story
    const { data: story } = await supabase.from('stories')
      .select('id, creator_id').eq('id', storyId).single();

    if (!story) return res.status(404).json({ error: 'Story not found' });

    // Vérifier que c'est le créateur
    if (story.creator_id !== userId) {
      return res.status(403).json({ error: 'Can only delete own stories' });
    }

    // Supprimer la story
    const { error } = await supabase.from('stories').delete().eq('id', storyId);
    if (error) throw error;

    res.json({ message: 'Story deleted' });
  } catch (err) {
    console.error('DELETE /stories/:storyId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
