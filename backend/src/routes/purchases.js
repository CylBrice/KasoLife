// ============================================================
// KASOLIFE — Routes /purchases v1.0
// Historique des achats d'un fan : posts PPV, albums, items.
// Contenu accessible uniquement en streaming (jamais en DL).
// ============================================================
'use strict';

const express  = require('express');
const { Pool } = require('pg');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const pool   = new Pool({ connectionString: process.env.DATABASE_URL });

// ── GET /purchases/my — liste tous les achats du fan connecté
router.get('/my', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const type   = req.query.type; // 'post' | 'album' | 'album_item' | undefined (all)

  try {
    const rows = [];

    // ── 1. Posts PPV achetés ─────────────────────────────────
    if (!type || type === 'post') {
      const { rows: posts } = await pool.query(`
        SELECT
          pp.id            AS purchase_id,
          'post'           AS purchase_type,
          pp.post_id       AS item_id,
          pp.price_xcon    AS price_paid_xcon,
          pp.created_at    AS purchased_at,
          p.title,
          p.description,
          p.media_url,
          p.thumbnail_url,
          p.media_type,
          u.id             AS creator_id,
          u.pseudo         AS creator_pseudo,
          cp.display_name  AS creator_name,
          u.avatar_url     AS creator_avatar
        FROM post_purchases pp
        JOIN posts    p  ON p.id = pp.post_id
        JOIN users    u  ON u.id = p.creator_id
        LEFT JOIN creator_profiles cp ON cp.user_id = u.id
        WHERE pp.buyer_id = $1
        ORDER BY pp.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      rows.push(...posts);
    }

    // ── 2. Albums entiers achetés ────────────────────────────
    if (!type || type === 'album') {
      const { rows: albums } = await pool.query(`
        SELECT
          ap.id            AS purchase_id,
          'album'          AS purchase_type,
          ap.album_id      AS item_id,
          ap.price_paid_xcon,
          ap.purchased_at,
          a.title,
          a.description,
          a.cover_url      AS thumbnail_url,
          a.type           AS media_type,
          a.items_count,
          u.id             AS creator_id,
          u.pseudo         AS creator_pseudo,
          cp.display_name  AS creator_name,
          u.avatar_url     AS creator_avatar
        FROM album_purchases ap
        JOIN albums a  ON a.id = ap.album_id
        JOIN users  u  ON u.id = ap.creator_id
        LEFT JOIN creator_profiles cp ON cp.user_id = u.id
        WHERE ap.buyer_id = $1
          AND ap.album_id IS NOT NULL
        ORDER BY ap.purchased_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      rows.push(...albums);
    }

    // ── 3. Items isolés achetés ──────────────────────────────
    if (!type || type === 'album_item') {
      const { rows: items } = await pool.query(`
        SELECT
          ap.id            AS purchase_id,
          'album_item'     AS purchase_type,
          ap.item_id       AS item_id,
          ap.price_paid_xcon,
          ap.purchased_at,
          ai.title,
          ai.media_url,
          ai.thumbnail_url,
          'PHOTO'          AS media_type,
          al.id            AS album_id,
          al.title         AS album_title,
          u.id             AS creator_id,
          u.pseudo         AS creator_pseudo,
          cp.display_name  AS creator_name,
          u.avatar_url     AS creator_avatar
        FROM album_purchases ap
        JOIN album_items     ai ON ai.id = ap.item_id
        JOIN albums          al ON al.id = ai.album_id
        JOIN users            u ON u.id  = ap.creator_id
        LEFT JOIN creator_profiles cp ON cp.user_id = u.id
        WHERE ap.buyer_id = $1
          AND ap.item_id IS NOT NULL
        ORDER BY ap.purchased_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      rows.push(...items);
    }

    // Tri global par date décroissante
    rows.sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at));

    // Pagination simple : on retourne un maximum de `limit` éléments globaux
    const paginated = rows.slice(0, limit);

    res.json({ purchases: paginated, page, limit, has_more: rows.length > limit });
  } catch (err) {
    console.error('GET /purchases/my error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /purchases/my/count — compteurs par type (badge navbar)
router.get('/my/count', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows: [counts] } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM post_purchases WHERE buyer_id = $1)    AS posts,
        (SELECT COUNT(*) FROM album_purchases WHERE buyer_id = $1
          AND album_id IS NOT NULL)                                   AS albums,
        (SELECT COUNT(*) FROM album_purchases WHERE buyer_id = $1
          AND item_id IS NOT NULL)                                    AS album_items
    `, [userId]);

    res.json({
      posts:       parseInt(counts.posts),
      albums:      parseInt(counts.albums),
      album_items: parseInt(counts.album_items),
      total:       parseInt(counts.posts) + parseInt(counts.albums) + parseInt(counts.album_items),
    });
  } catch (err) {
    console.error('GET /purchases/my/count error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
