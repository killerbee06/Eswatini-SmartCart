/**
 * Delivery Address Service
 *
 * Manages customer delivery addresses with default address support.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';

/**
 * Get all delivery addresses for a customer
 */
async function getAddresses(profileId) {
  return db('delivery_addresses')
    .where({ profile_id: profileId })
    .orderBy('is_default', 'desc')
    .orderBy('created_at', 'desc');
}

/**
 * Add a new delivery address
 */
async function addAddress(profileId, data) {
  // If setting as default, unset other defaults
  if (data.is_default) {
    await db('delivery_addresses')
      .where({ profile_id: profileId, is_default: true })
      .update({ is_default: false });
  }

  // If this is the first address, make it default
  const [{ count }] = await db('delivery_addresses')
    .where({ profile_id: profileId })
    .count('id as count');
  const isFirst = parseInt(count, 10) === 0;

  const [address] = await db('delivery_addresses').insert({
    profile_id: profileId,
    label: data.label || 'Home',
    address_line_1: data.address_line_1,
    address_line_2: data.address_line_2 || null,
    city: data.city || null,
    region: data.region || null,
    postal_code: data.postal_code || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    is_default: isFirst || data.is_default || false,
  }).returning('*');

  return address;
}

/**
 * Update a delivery address
 */
async function updateAddress(profileId, addressId, data) {
  const address = await db('delivery_addresses')
    .where({ id: addressId, profile_id: profileId })
    .first();

  if (!address) throw new AppError('Address not found.', 404);

  if (data.is_default) {
    await db('delivery_addresses')
      .where({ profile_id: profileId, is_default: true })
      .update({ is_default: false });
  }

  const allowed = ['label', 'address_line_1', 'address_line_2', 'city', 'region', 'postal_code', 'latitude', 'longitude', 'is_default'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  updates.updated_at = new Date();

  const [updated] = await db('delivery_addresses')
    .where({ id: addressId })
    .update(updates)
    .returning('*');

  return updated;
}

/**
 * Delete a delivery address
 */
async function deleteAddress(profileId, addressId) {
  const deleted = await db('delivery_addresses')
    .where({ id: addressId, profile_id: profileId })
    .del();

  if (!deleted) throw new AppError('Address not found.', 404);

  // If deleted was default, make another address default
  const remaining = await db('delivery_addresses')
    .where({ profile_id: profileId })
    .orderBy('created_at', 'asc')
    .first();

  if (remaining) {
    await db('delivery_addresses').where({ id: remaining.id }).update({ is_default: true });
  }

  return { message: 'Address deleted' };
}

export default {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};
