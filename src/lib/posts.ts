import { getPool } from "@/lib/db";

export type FeedPost = {
  id: number;
  user_id: number | null;
  pet_id: number | null;
  type: string;
  title: string;
  description: string;
  species: string;
  photo_path: string | null;
  media_type: string | null;
  location_text: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  author_name: string | null;
  author_avatar_path: string | null;
  pet_name: string | null;
  pet_sex: string | null;
  pet_breed: string | null;
  pet_photo_path: string | null;
  pet_slug: string | null;
  pet_last_seen_text: string | null;
  pet_last_seen_notes: string | null;
  pet_last_seen_at: Date | string | null;
  pet_last_seen_lat: number | string | null;
  pet_last_seen_lng: number | string | null;
  pet_show_phone: number | null;
  pet_show_email: number | null;
  pet_show_messenger: number | null;
  pet_show_address: number | null;
  pet_home_lat: number | string | null;
  pet_home_lng: number | string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_messenger: string | null;
  owner_address_lat: number | string | null;
  owner_address_lng: number | string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
};

export type AlertFeedFilters = {
  type?: string;
  species?: string;
  sex?: string;
  sort?: string;
  within?: string;
  nearLat?: number;
  nearLng?: number;
  /** Radius in miles from nearLat/nearLng */
  radiusMiles?: number;
  limit?: number;
};

function withinMonths(within?: string): number | null {
  switch (within) {
    case "1m":
      return 1;
    case "3m":
      return 3;
    case "6m":
      return 6;
    case "1y":
      return 12;
    default:
      return null;
  }
}

function isBadField(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; message?: string };
  if (e.code === "ER_BAD_FIELD_ERROR" || e.errno === 1054) return true;
  return /unknown column/i.test(String(e.message || ""));
}

/** Approx miles between two lat/lng points (Haversine), for SQL. */
const HAVERSINE_MILES = `(
  3958.8 * ACOS(
    LEAST(1, GREATEST(-1,
      COS(RADIANS(?)) * COS(RADIANS(COALESCE(posts.location_lat, pets.last_seen_lat)))
      * COS(RADIANS(COALESCE(posts.location_lng, pets.last_seen_lng)) - RADIANS(?))
      + SIN(RADIANS(?)) * SIN(RADIANS(COALESCE(posts.location_lat, pets.last_seen_lat)))
    ))
  )
)`;

type SelectMode = "full" | "compat" | "minimal";

function feedSelect(mode: SelectMode): string {
  if (mode === "full") {
    return `
      posts.id, posts.user_id, posts.pet_id, posts.type, posts.title, posts.description, posts.species,
      posts.photo_path, posts.media_type, posts.location_text,
      posts.location_lat, posts.location_lng,
      posts.contact_name, posts.contact_phone, posts.contact_email,
      posts.status, posts.created_at, posts.updated_at,
      users.name AS author_name,
      users.avatar_path AS author_avatar_path,
      pets.name AS pet_name,
      pets.sex AS pet_sex,
      pets.breed AS pet_breed,
      pets.photo_path AS pet_photo_path,
      pets.public_slug AS pet_slug,
      pets.last_seen_text AS pet_last_seen_text,
      pets.last_seen_notes AS pet_last_seen_notes,
      pets.last_seen_at AS pet_last_seen_at,
      pets.last_seen_lat AS pet_last_seen_lat,
      pets.last_seen_lng AS pet_last_seen_lng,
      pets.show_phone AS pet_show_phone,
      pets.show_email AS pet_show_email,
      pets.show_messenger AS pet_show_messenger,
      pets.show_address AS pet_show_address,
      pets.home_lat AS pet_home_lat,
      pets.home_lng AS pet_home_lng,
      users.phone AS owner_phone,
      users.email AS owner_email,
      users.messenger AS owner_messenger,
      users.address_lat AS owner_address_lat,
      users.address_lng AS owner_address_lng,
      COALESCE(lc.like_count, 0) AS like_count,
      COALESCE(cc.comment_count, 0) AS comment_count,
      COALESCE(posts.share_count, 0) AS share_count
    `;
  }

  // Older DBs may be missing avatar / map / notes / share_count columns.
  return `
      posts.id, posts.user_id, posts.pet_id, posts.type, posts.title, posts.description, posts.species,
      posts.photo_path, posts.media_type, posts.location_text,
      NULL AS location_lat, NULL AS location_lng,
      posts.contact_name, posts.contact_phone, posts.contact_email,
      posts.status, posts.created_at, posts.updated_at,
      users.name AS author_name,
      NULL AS author_avatar_path,
      pets.name AS pet_name,
      pets.sex AS pet_sex,
      pets.breed AS pet_breed,
      pets.photo_path AS pet_photo_path,
      pets.public_slug AS pet_slug,
      pets.last_seen_text AS pet_last_seen_text,
      NULL AS pet_last_seen_notes,
      pets.last_seen_at AS pet_last_seen_at,
      NULL AS pet_last_seen_lat,
      NULL AS pet_last_seen_lng,
      NULL AS pet_show_phone,
      NULL AS pet_show_email,
      NULL AS pet_show_messenger,
      NULL AS pet_show_address,
      NULL AS pet_home_lat,
      NULL AS pet_home_lng,
      NULL AS owner_phone,
      NULL AS owner_email,
      NULL AS owner_messenger,
      NULL AS owner_address_lat,
      NULL AS owner_address_lng,
      COALESCE(lc.like_count, 0) AS like_count,
      COALESCE(cc.comment_count, 0) AS comment_count,
      0 AS share_count
    `;
}

async function queryFeedPosts(
  opts: AlertFeedFilters,
  mode: SelectMode,
): Promise<FeedPost[]> {
  const type = opts.type && opts.type !== "all" ? opts.type : null;
  const limit = opts.limit ?? 40;
  const pool = getPool();
  const isAlert =
    type === "missing" || type === "found" || type === "resolved";
  const useGeo = mode === "full";

  let sql = `
    SELECT
      ${feedSelect(mode)}
    FROM posts
    LEFT JOIN users ON users.id = posts.user_id
    LEFT JOIN pets ON pets.id = posts.pet_id
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS like_count FROM post_likes GROUP BY post_id
    ) lc ON lc.post_id = posts.id
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count FROM post_comments GROUP BY post_id
    ) cc ON cc.post_id = posts.id
  `;
  const params: unknown[] = [];
  const where: string[] = [`posts.hidden_at IS NULL`];

  if (type === "resolved") {
    where.push(`posts.status = 'resolved' AND posts.type IN ('missing', 'found')`);
  } else if (type === "missing" || type === "found") {
    where.push(`posts.type = ? AND posts.status = 'open'`);
    params.push(type);
  } else if (type) {
    where.push(`posts.type = ? AND posts.status = 'open'`);
    params.push(type);
  } else {
    where.push(`posts.status = 'open'`);
  }

  if (isAlert) {
    const species = (opts.species || "").trim();
    if (species && species.toLowerCase() !== "all") {
      where.push(`LOWER(COALESCE(pets.species, posts.species)) = LOWER(?)`);
      params.push(species);
    }

    const sex = (opts.sex || "").trim().toLowerCase();
    if (sex && sex !== "all") {
      where.push(`LOWER(COALESCE(pets.sex, 'unknown')) = ?`);
      params.push(sex);
    }

    const months = withinMonths(opts.within);
    if (months) {
      where.push(`posts.created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)`);
      params.push(months);
    }

    const radius = opts.radiusMiles != null && opts.radiusMiles > 0 ? opts.radiusMiles : null;
    if (useGeo && radius != null && opts.nearLat != null && opts.nearLng != null) {
      where.push(`COALESCE(posts.location_lat, pets.last_seen_lat) IS NOT NULL`);
      where.push(`COALESCE(posts.location_lng, pets.last_seen_lng) IS NOT NULL`);
      where.push(`${HAVERSINE_MILES} <= ?`);
      params.push(opts.nearLat, opts.nearLng, opts.nearLat, radius);
    }
  }

  if (where.length) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  const sort = (opts.sort || "updated").toLowerCase();
  if (
    useGeo &&
    isAlert &&
    sort === "nearest" &&
    opts.nearLat != null &&
    opts.nearLng != null
  ) {
    sql += ` ORDER BY
      CASE
        WHEN COALESCE(posts.location_lat, pets.last_seen_lat) IS NULL THEN 1
        ELSE 0
      END ASC,
      ${HAVERSINE_MILES} ASC,
      posts.updated_at DESC`;
    params.push(opts.nearLat, opts.nearLng, opts.nearLat);
  } else if (isAlert && sort === "posted") {
    sql += ` ORDER BY posts.created_at DESC`;
  } else if (isAlert) {
    sql += ` ORDER BY posts.updated_at DESC`;
  } else {
    sql += ` ORDER BY posts.created_at DESC`;
  }

  sql += ` LIMIT ${Number(limit)}`;

  const [rows] = await pool.query(sql, params);
  return rows as FeedPost[];
}

export async function listFeedPosts(opts: AlertFeedFilters = {}): Promise<FeedPost[]> {
  try {
    return await queryFeedPosts(opts, "full");
  } catch (err) {
    if (!isBadField(err)) throw err;
    console.warn(
      "[feed] Missing DB columns — using compat query. Run sql/migration_user_avatar.sql and sql/migration_map_coords.sql on production.",
    );
    return await queryFeedPosts(opts, "compat");
  }
}

function postDetailSelect(mode: SelectMode): string {
  if (mode === "full") {
    return `
      posts.*,
      users.name AS author_name,
      users.avatar_path AS author_avatar_path,
      pets.name AS pet_name,
      pets.photo_path AS pet_photo_path,
      pets.sex AS pet_sex,
      pets.breed AS pet_breed,
      pets.public_slug AS pet_slug,
      pets.last_seen_text AS pet_last_seen_text,
      pets.last_seen_notes AS pet_last_seen_notes,
      pets.last_seen_at AS pet_last_seen_at,
      pets.last_seen_lat AS pet_last_seen_lat,
      pets.last_seen_lng AS pet_last_seen_lng,
      pets.last_seen_media_path,
      pets.last_seen_media_type,
      pets.medical_notes AS pet_medical_notes,
      pets.show_phone AS pet_show_phone,
      pets.show_email AS pet_show_email,
      pets.show_messenger AS pet_show_messenger,
      pets.show_address AS pet_show_address,
      pets.home_lat AS pet_home_lat,
      pets.home_lng AS pet_home_lng,
      users.phone AS owner_phone,
      users.email AS owner_email,
      users.messenger AS owner_messenger,
      users.address_lat AS owner_address_lat,
      users.address_lng AS owner_address_lng
    `;
  }
  if (mode === "compat") {
    return `
      posts.*,
      users.name AS author_name,
      NULL AS author_avatar_path,
      pets.name AS pet_name,
      pets.photo_path AS pet_photo_path,
      pets.sex AS pet_sex,
      pets.breed AS pet_breed,
      pets.public_slug AS pet_slug,
      pets.last_seen_text AS pet_last_seen_text,
      pets.last_seen_notes AS pet_last_seen_notes,
      pets.last_seen_at AS pet_last_seen_at,
      NULL AS pet_last_seen_lat,
      NULL AS pet_last_seen_lng,
      NULL AS last_seen_media_path,
      NULL AS last_seen_media_type,
      pets.medical_notes AS pet_medical_notes,
      pets.show_phone AS pet_show_phone,
      pets.show_email AS pet_show_email,
      pets.show_messenger AS pet_show_messenger,
      pets.show_address AS pet_show_address,
      NULL AS pet_home_lat,
      NULL AS pet_home_lng,
      users.phone AS owner_phone,
      users.email AS owner_email,
      users.messenger AS owner_messenger,
      NULL AS owner_address_lat,
      NULL AS owner_address_lng
    `;
  }
  // Absolute fallback for older schemas — core fields only.
  return `
      posts.id, posts.user_id, posts.pet_id, posts.type, posts.title, posts.description,
      posts.species, posts.photo_path, posts.media_type, posts.location_text,
      posts.contact_name, posts.contact_phone, posts.contact_email, posts.status,
      posts.created_at, posts.updated_at,
      users.name AS author_name,
      NULL AS author_avatar_path,
      pets.name AS pet_name,
      pets.photo_path AS pet_photo_path,
      pets.sex AS pet_sex,
      pets.breed AS pet_breed,
      pets.public_slug AS pet_slug,
      pets.last_seen_text AS pet_last_seen_text,
      NULL AS pet_last_seen_notes,
      pets.last_seen_at AS pet_last_seen_at,
      NULL AS pet_last_seen_lat,
      NULL AS pet_last_seen_lng,
      NULL AS last_seen_media_path,
      NULL AS last_seen_media_type,
      NULL AS pet_medical_notes,
      pets.show_phone AS pet_show_phone,
      pets.show_email AS pet_show_email,
      pets.show_messenger AS pet_show_messenger,
      pets.show_address AS pet_show_address,
      NULL AS pet_home_lat,
      NULL AS pet_home_lng,
      users.phone AS owner_phone,
      users.email AS owner_email,
      users.messenger AS owner_messenger,
      NULL AS owner_address_lat,
      NULL AS owner_address_lng,
      NULL AS hidden_at,
      NULL AS hidden_reason
    `;
}

export async function getPostById(id: number, opts?: { includeHidden?: boolean }) {
  const pool = getPool();

  async function run(mode: SelectMode, withHiddenFilter: boolean) {
    const hiddenClause =
      !opts?.includeHidden && withHiddenFilter ? "AND posts.hidden_at IS NULL" : "";
    const [rows] = await pool.query(
      `SELECT
        ${postDetailSelect(mode)}
       FROM posts
       LEFT JOIN users ON users.id = posts.user_id
       LEFT JOIN pets ON pets.id = posts.pet_id
       WHERE posts.id = ? ${hiddenClause}
       LIMIT 1`,
      [id],
    );
    const list = rows as Record<string, unknown>[];
    const row = list[0] ?? null;
    if (row && !opts?.includeHidden && row.hidden_at) return null;
    return row;
  }

  const modes: SelectMode[] = ["full", "compat", "minimal"];
  let lastErr: unknown;
  for (const mode of modes) {
    try {
      return await run(mode, true);
    } catch (err) {
      lastErr = err;
      if (!isBadField(err)) throw err;
      console.warn(`[post] Missing DB columns — retrying with ${mode === "full" ? "compat" : "minimal"} query.`);
    }
  }

  // hidden_at column itself may be missing
  try {
    return await run("minimal", false);
  } catch (err) {
    lastErr = err;
    throw lastErr;
  }
}

export type PostMediaItem = {
  id: number;
  file_path: string;
  media_type: "image" | "video" | string;
  sort_order: number;
};

export async function listPostMedia(postId: number): Promise<PostMediaItem[]> {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT id, file_path, media_type, sort_order
       FROM post_media
       WHERE post_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [postId],
    );
    return rows as PostMediaItem[];
  } catch {
    // Table may not exist until migration runs
    return [];
  }
}
