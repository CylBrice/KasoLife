export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

export interface CreatorSummary {
  user_id: string;
  display_name: string;
  subscription_price_xcon: number;
  is_verified_badge: boolean;
  subscribers_count: number;
  posts_count: number;
  created_at: string;
  category?: Category;
  user?: {
    pseudo: string;
    avatar_url?: string;
    banner_url?: string;
    bio?: string;
  };
}

export interface Post {
  id: string;
  creator_id: string;
  creator?: { pseudo: string; avatar_url?: string };
  category?: { name: string; slug: string };
  caption?: string;
  media_type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
  media_url?: string | null;
  thumbnail_url?: string | null;
  access_level: "FREE" | "SUBSCRIBERS" | "PPV";
  price_xcon: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  has_access: boolean;
  access_reason: string;
}

export interface UserProfile {
  id: string;
  pseudo: string;
  name?: string;
  role: "user" | "influencer" | "admin" | "super_admin" | "root_admin";
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  kyc_status: "PENDING" | "VERIFIED" | "FAILED" | "SUPPORT";
}

export interface Wallet {
  balance_xcon: number;
  pending_balance_xcon: number;
  total_deposited: number;
  total_withdrawn: number;
  total_earned: number;
}

export interface CreatorStats {
  profile: {
    subscribers_count: number;
    posts_count: number;
    total_likes?: number;
    subscription_price_xcon: number;
  };
  wallet: Wallet;
  revenue_30d: {
    subscriptions: number;
    tips: number;
    ppv: number;
    total: number;
  };
}

export interface MyPost {
  id: string;
  caption?: string;
  media_type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
  media_url?: string | null;
  thumbnail_url?: string | null;
  access_level: "FREE" | "SUBSCRIBERS" | "PPV";
  price_xcon: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_published: boolean;
  is_flagged: boolean;
  category?: { name: string; slug: string };
}

export interface Subscriber {
  id: string;
  price_xcon: number;
  status: string;
  started_at: string;
  current_period_end: string;
  auto_renew: boolean;
  fan: { id: string; pseudo: string; avatar_url?: string };
}

export interface Conversation {
  user: { id: string; pseudo: string; avatar_url?: string; role: string };
  last_message: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content?: string;
    media_url?: string;
    price_xcon: number;
    is_paid: boolean;
    created_at: string;
  };
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content?: string | null;
  media_url?: string | null;
  price_xcon: number;
  is_paid: boolean;
  paid_by?: string;
  created_at: string;
  locked: boolean;
}

export interface CreatorApplication {
  id: string;
  user_id: string;
  display_name: string;
  motivation?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  user?: { pseudo: string; kyc_status: string; created_at: string };
  category?: { name: string; slug: string };
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: "POST" | "COMMENT" | "MESSAGE" | "USER";
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter?: { pseudo: string };
}

export interface Payout {
  id: string;
  creator_id: string;
  amount_xcon: number;
  commission_xcon: number;
  net_amount_xcon: number;
  method: string;
  operator?: string;
  phone?: string;
  status: string;
  created_at: string;
  creator?: { pseudo: string; kyc_status: string };
}

export interface AdminUser {
  id: string;
  pseudo: string;
  name?: string;
  role: string;
  is_active: boolean;
  country_iso?: string;
  kyc_status: string;
  created_at: string;
  last_active?: string;
}

export interface AdminStats {
  total_users: number;
  total_creators: number;
  total_posts: number;
  active_subscriptions: number;
  total_revenue_xcon: number;
  total_user_balances_xcon: number;
  total_pending_creator_earnings_xcon: number;
}

export interface Subscription {
  id: string;
  price_xcon: number;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
  started_at: string;
  current_period_end: string;
  auto_renew: boolean;
  creator?: {
    id: string;
    pseudo: string;
    avatar_url?: string;
    creator_profile?: {
      display_name: string;
      category?: { name: string; slug: string };
    };
  };
}
