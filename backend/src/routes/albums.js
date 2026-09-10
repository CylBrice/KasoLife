// ============================================================
// KASOLIFE — Routes /albums v1.0
// Albums photo/vidéo payants par les créateurs.
// Achat = accès permanent à l'état courant de l'album.
// Vente à l'album entier OU à la pièce isolée.
// ============================================================
'use strict';

const express    = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase   = require('../config/supabase');
const { authMiddleware, requireMinRole, requireNotWalletFrozen,
        logAdminContentView, isAdminRole } = require('../middleware/auth');
const { PPV_PRICE_MIN, PPV_PRICE_MAX } = require('../config/constants');
const configService = require('../services/configService');

const router = express.Router();

// ── Helper : vérifier si un viewer a accès à un album ───────
const resolveAlbumAccess = async (album, viewerId, viewerRole) => {
  if (album.access_level === 'FREE')     return { ok: true, reason: 'FREE' };
  if (!viewerId)                          return { ok: false, reason: 'AUTH_REQUIRED' };
  if (viewerId === album.creator_id)      return { ok: true, reason: 'OWNER' };
  if (isAdminRole(viewerRole))            return { ok: true, reason: 'ADMIN_ACCESS' };

  if (album.access_level === 'SUBSCRIBERS') {
    const { data } = await supabase.from('subscriptions')
      .select('id').eq('fan_id', viewerId).eq('creator_id', album.creator_id)
      .eq('status', 'ACTIVE').single();
    return { ok: !!data, reason: data ? 'SUBSCRIBED' : 'SUBSCRIPTION_REQUIRED' };
  }

  if (album.access_level === 'PPV') {
    // Abonné avec fan_club_tier >= 1 : accès compris
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, fan_club_tier').eq('fan_id', viewerId).eq('creator_id', album.creator_id)
      .eq('status', 'ACTIVE').single();
    if (sub?.fan_club_tier >= 1) return { ok: true, reason: 'FAN_CLUB' };

    // Achat album entier
    const { data: purchase } = await supabase.from('album_purchases')
      .select('id').eq('album_id', album.id).eq('buyer_id', viewerId).single();
    return { ok: !!purchase, reason: purchase ? 'PURCHASED' : 'PURCHASE_REQUIRED' };
  }

  return { ok: false, reason: 'UNKNOWN' };
};

// ── GET /albums — liste des albums publiés (par créateur optionnel)
router.get('/', async (req, res) => {
  try {
    const { creator_id, type, page = 1, limit = 20 } = req.query;
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (Math.max(1, parseInt(page) || 1) - 1) * pageSize;

    let query = supabase.from('albums')
      .select('id, creator_id, title, description, type, cover_url, price_xcon, access_level, items_count, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (creator_id) query = query.eq('creator_id', creator_id);
    if (type && ['PHOTO', 'VIDEO'].includes(type)) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /albums/:albumId — détail album + items (si accès)
router.get('/:albumId', async (req, res) => {
  try {
    const { albumId } = req.params;
    const viewerId   = req.user?.id;
    const viewerRole = req.user?.role;

    const { data: album, error } = await supabase.from('albums')
      .select('*').eq('id', albumId).eq('is_published', true).single();
    if (error || !album) return res.status(404).json({ error: 'Album introuvable' });

    const { ok, reason } = await resolveAlbumAccess(album, viewerId, viewerRole);

    if (reason === 'ADMIN_ACCESS') logAdminContentView(req, 'album', albumId);

    // Sans accès : retourner les métadonnées uniquement (pas les items)
    if (!ok) {
      return res.json({ ...album, has_access: false, access_reason: reason, items: [] });
    }

    const { data: items } = await supabase.from('album_items')
      .select('id, media_url, thumbnail_url, title, position, price_xcon')
      .eq('album_id', albumId)
      .order('position', { ascending: true });

    // Pour les items avec vente individuelle, vérifier quels items sont achetés
    let purchasedItems = new Set();
    if (viewerId) {
      const { data: purchases } = await supabase.from('album_purchases')
        .select('item_id').eq('buyer_id', viewerId).not('item_id', 'is', null);
      (purchases || []).forEach(p => purchasedItems.add(p.item_id));
    }

    const enrichedItems = (items || []).map(item => ({
      ...item,
      has_access: ok || purchasedItems.has(item.id),
    }));

    res.json({ ...album, has_access: true, access_reason: reason, items: enrichedItems });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /albums — créer un album (créateur uniquement)
router.post('/', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { title, description, type, cover_url, price_xcon, access_level } = req.body;

    if (!title?.trim())       return res.status(400).json({ error: 'Titre requis' });
    if (!['PHOTO','VIDEO'].includes(type))
      return res.status(400).json({ error: 'Type doit être PHOTO ou VIDEO' });
    if (!['FREE','SUBSCRIBERS','PPV'].includes(access_level || 'PPV'))
      return res.status(400).json({ error: 'access_level invalide' });

    const price = Number(price_xcon) || 0;
    if (price > 0 && (price < PPV_PRICE_MIN || price > PPV_PRICE_MAX))
      return res.status(400).json({ error: `Prix entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });

    const { data, error } = await supabase.from('albums').insert({
      id: uuidv4(), creator_id: req.user.id,
      title: title.trim(), description: description || null,
      type, cover_url: cover_url || null,
      price_xcon: price,
      access_level: access_level || 'PPV',
    }).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /albums/:albumId — mettre à jour un album
router.patch('/:albumId', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { albumId } = req.params;
    const { title, description, cover_url, price_xcon, access_level, is_published } = req.body;

    const { data: album } = await supabase.from('albums')
      .select('id, creator_id').eq('id', albumId).single();
    if (!album) return res.status(404).json({ error: 'Album introuvable' });
    if (album.creator_id !== req.user.id && !isAdminRole(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    const updates = {};
    if (title !== undefined)        updates.title        = title.trim();
    if (description !== undefined)  updates.description  = description;
    if (cover_url !== undefined)    updates.cover_url    = cover_url;
    if (access_level !== undefined) updates.access_level = access_level;
    if (is_published !== undefined) updates.is_published = is_published;
    if (price_xcon !== undefined) {
      const p = Number(price_xcon) || 0;
      if (p > 0 && (p < PPV_PRICE_MIN || p > PPV_PRICE_MAX))
        return res.status(400).json({ error: `Prix entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });
      updates.price_xcon = p;
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('albums')
      .update(updates).eq('id', albumId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /albums/:albumId/items — ajouter un item à un album
router.post('/:albumId/items', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { albumId } = req.params;
    const { media_url, thumbnail_url, title, position, price_xcon } = req.body;

    if (!media_url) return res.status(400).json({ error: 'media_url requis' });

    const { data: album } = await supabase.from('albums')
      .select('id, creator_id, type').eq('id', albumId).single();
    if (!album) return res.status(404).json({ error: 'Album introuvable' });
    if (album.creator_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });

    const price = Number(price_xcon) || 0;
    if (price > 0 && (price < PPV_PRICE_MIN || price > PPV_PRICE_MAX))
      return res.status(400).json({ error: `Prix pièce entre ${PPV_PRICE_MIN} et ${PPV_PRICE_MAX} FCFA` });

    // Calculer la prochaine position si non fournie
    let pos = parseInt(position);
    if (isNaN(pos)) {
      const { count } = await supabase.from('album_items')
        .select('id', { count: 'exact', head: true }).eq('album_id', albumId);
      pos = count || 0;
    }

    const { data, error } = await supabase.from('album_items').insert({
      id: uuidv4(), album_id: albumId, creator_id: req.user.id,
      media_url, thumbnail_url: thumbnail_url || null,
      title: title || null, position: pos, price_xcon: price,
    }).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /albums/:albumId/items/:itemId — supprimer un item
router.delete('/:albumId/items/:itemId', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { albumId, itemId } = req.params;
    const { data: item } = await supabase.from('album_items')
      .select('id, creator_id').eq('id', itemId).eq('album_id', albumId).single();
    if (!item) return res.status(404).json({ error: 'Item introuvable' });
    if (item.creator_id !== req.user.id && !isAdminRole(req.user.role))
      return res.status(403).json({ error: 'Accès refusé' });

    await supabase.from('album_items').delete().eq('id', itemId);
    res.json({ message: 'Item supprimé' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /albums/:albumId/purchase — acheter un album entier
router.post('/:albumId/purchase', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { albumId } = req.params;

    const { data: album } = await supabase.from('albums')
      .select('id, creator_id, title, price_xcon, access_level, is_published').eq('id', albumId).single();
    if (!album || !album.is_published) return res.status(404).json({ error: 'Album introuvable' });
    if (album.creator_id === req.user.id)
      return res.status(400).json({ error: 'Vous êtes le créateur de cet album' });
    if (album.price_xcon === 0)
      return res.status(400).json({ error: 'Cet album n\'est pas en vente directe' });

    // Vérifier non déjà acheté
    const { data: existing } = await supabase.from('album_purchases')
      .select('id').eq('album_id', albumId).eq('buyer_id', req.user.id).single();
    if (existing) return res.status(400).json({ error: 'Album déjà acheté' });

    // Admin bypass
    if (req.isAdminAccess) {
      logAdminContentView(req, 'album', albumId);
      return res.json({ message: 'Accès admin — album accessible sans paiement', admin_access: true });
    }

    const ppvRate     = await configService.getCommissionRate('ppv');
    const price       = album.price_xcon;
    const commission  = Math.floor(price * ppvRate);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant' });
      throw debitErr;
    }

    const purchaseId = uuidv4();
    await supabase.from('album_purchases').insert({
      id: purchaseId, buyer_id: req.user.id, creator_id: album.creator_id,
      album_id: albumId, item_id: null,
      price_paid_xcon: price, commission_xcon: commission,
    });
    await supabase.rpc('credit_pending_balance', { p_user_id: album.creator_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'PPV_PAYMENT', amount_xcon: -price,
        balance_after: newBalance, description: `Album "${album.title}"`,
        related_user_id: album.creator_id,
      },
      {
        id: uuidv4(), user_id: album.creator_id, type: 'PPV_INCOME', amount_xcon: creatorShare,
        balance_after: 0,
        description: `Vente album "${album.title}" (commission ${(ppvRate * 100).toFixed(0)}%)`,
        related_user_id: req.user.id,
      },
    ]);
    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_PPV', amount_xcon: commission,
      reference_id: purchaseId, user_id: album.creator_id,
    });

    res.json({ message: 'Album acheté', balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /albums/:albumId/items/:itemId/purchase — acheter une pièce isolée
router.post('/:albumId/items/:itemId/purchase', authMiddleware, requireNotWalletFrozen, async (req, res) => {
  try {
    const { albumId, itemId } = req.params;

    const { data: item } = await supabase.from('album_items')
      .select('id, album_id, creator_id, title, price_xcon').eq('id', itemId).eq('album_id', albumId).single();
    if (!item) return res.status(404).json({ error: 'Item introuvable' });
    if (item.creator_id === req.user.id)
      return res.status(400).json({ error: 'Vous êtes le créateur' });
    if (item.price_xcon === 0)
      return res.status(400).json({ error: 'Cet item n\'est pas vendu individuellement' });

    const { data: existing } = await supabase.from('album_purchases')
      .select('id').eq('item_id', itemId).eq('buyer_id', req.user.id).single();
    if (existing) return res.status(400).json({ error: 'Item déjà acheté' });

    if (req.isAdminAccess) {
      logAdminContentView(req, 'album_item', itemId);
      return res.json({ message: 'Accès admin', admin_access: true });
    }

    const ppvRate      = await configService.getCommissionRate('ppv');
    const price        = item.price_xcon;
    const commission   = Math.floor(price * ppvRate);
    const creatorShare = price - commission;

    const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
      p_user_id: req.user.id, p_amount: price,
    });
    if (debitErr) {
      if (debitErr.message?.includes('Solde insuffisant'))
        return res.status(402).json({ error: 'Solde insuffisant' });
      throw debitErr;
    }

    const purchaseId = uuidv4();
    await supabase.from('album_purchases').insert({
      id: purchaseId, buyer_id: req.user.id, creator_id: item.creator_id,
      album_id: null, item_id: itemId,
      price_paid_xcon: price, commission_xcon: commission,
    });
    await supabase.rpc('credit_pending_balance', { p_user_id: item.creator_id, p_amount: creatorShare });

    await supabase.from('transactions').insert([
      {
        id: uuidv4(), user_id: req.user.id, type: 'PPV_PAYMENT', amount_xcon: -price,
        balance_after: newBalance, description: `Pièce album "${item.title || itemId}"`,
        related_user_id: item.creator_id,
      },
      {
        id: uuidv4(), user_id: item.creator_id, type: 'PPV_INCOME', amount_xcon: creatorShare,
        balance_after: 0,
        description: `Vente pièce album (commission ${(ppvRate * 100).toFixed(0)}%)`,
        related_user_id: req.user.id,
      },
    ]);
    await supabase.from('platform_revenue').insert({
      id: uuidv4(), source_type: 'COMMISSION_PPV', amount_xcon: commission,
      reference_id: purchaseId, user_id: item.creator_id,
    });

    res.json({ message: 'Item acheté', balance_xcon: newBalance });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
