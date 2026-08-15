/**
 * Advertisement Service
 *
 * Manages platform advertisements: banners, promoted products, featured stores.
 * Age-restricted ads are filtered based on customer eligibility.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * List active advertisements for a given placement
 * Filters by date range and age restriction
 */
async function listAds({ placement, store_id, profile_id, page = 1, limit = 20 } = {}) {
  const now = new Date();
  let query = db('advertisements')
    .leftJoin('stores', 'stores.id', 'advertisements.store_id')
    .where('advertisements.status', 'ACTIVE')
    .where('advertisements.starts_at', '<=', now)
    .where('advertisements.expires_at', '>', now)
    .select(
      'advertisements.*',
      'stores.name as store_name',
      'stores.logo_url as store_logo'
    );

  if (placement) query = query.where('advertisements.placement', placement);
  if (store_id) query = query.where('advertisements.store_id', store_id);

  // Filter age-restricted ads if customer is underage
  if (profile_id) {
    const profile = await db('profiles').where({ id: profile_id }).first();
    if (profile && profile.date_of_birth) {
      const dob = new Date(profile.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18) {
        query = query.where('advertisements.age_restricted_ad', false);
      }
    }
  } else {
    // Anonymous users should not see age-restricted ads
    query = query.where('advertisements.age_restricted_ad', false);
  }

  const [{ count: total }] = await query.clone().count('advertisements.id as count');
  const data = await query.orderBy('advertisements.created_at', 'desc').limit(limit).offset((page - 1) * limit);

  return { data, total: parseInt(total, 10), page, limit };
}

/**
 * Get a single advertisement
 */
async function getAd(id) {
  return db('advertisements')
    .leftJoin('stores', 'stores.id', 'advertisements.store_id')
    .where('advertisements.id', id)
    .select('advertisements.*', 'stores.name as store_name', 'stores.logo_url as store_logo')
    .first();
}

/**
 * Admin/Merchant: create an advertisement
 */
async function createAd(data) {
  const [ad] = await db('advertisements').insert({
    store_id: data.store_id || null,
    title: data.title,
    description: data.description || null,
    image_url: data.image_url || null,
    banner_url: data.banner_url || null,
    destination_type: data.destination_type,
    destination_id: data.destination_id || null,
    placement: data.placement,
    ad_type: data.ad_type || 'BANNER',
    starts_at: data.starts_at,
    expires_at: data.expires_at,
    budget: data.budget || null,
    status: data.status || 'PENDING_APPROVAL',
    age_restricted_ad: data.age_restricted_ad || false,
  }).returning('*');

  return ad[0];
}

/**
 * Admin/Merchant: update an advertisement
 */
async function updateAd(id, data) {
  const allowed = [
    'title', 'description', 'image_url', 'banner_url', 'status',
    'starts_at', 'expires_at', 'budget', 'age_restricted_ad',
  ];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  updates.updated_at = new Date();

  const updated = await db('advertisements').where({ id }).update(updates).returning('*');
  if (!updated[0]) throw new AppError('Advertisement not found.', 404);
  return updated[0];
}

/**
 * Record an impression
 */
async function recordImpression(id) {
  await db('advertisements').where({ id }).increment('impressions', 1);
}

/**
 * Record a click
 */
async function recordClick(id) {
  await db('advertisements').where({ id }).increment('clicks', 1);
}

export default {
  listAds,
  getAd,
  createAd,
  updateAd,
  recordImpression,
  recordClick,
};
