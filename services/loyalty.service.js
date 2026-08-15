/**
 * Loyalty Service
 * 
 * Manages customer loyalty cards and loyalty-aware pricing.
 * Cards are stored with masked/hashed numbers — never expose full card numbers.
 */

import db from '../config/knex.js';
import { AppError } from '../shared/errors.js';
import crypto from 'crypto';

/**
 * Get customer's loyalty cards
 */
async function getMyCards(profileId) {
  const cards = await db('customer_loyalty_cards')
    .join('loyalty_providers', 'loyalty_providers.id', 'customer_loyalty_cards.loyalty_provider_id')
    .where('customer_loyalty_cards.profile_id', profileId)
    .where('customer_loyalty_cards.is_active', true)
    .select(
      'customer_loyalty_cards.id',
      'customer_loyalty_cards.card_last_four',
      'customer_loyalty_cards.created_at',
      'loyalty_providers.name as provider_name',
      'loyalty_providers.slug as provider_slug',
      'loyalty_providers.logo_url as provider_logo',
      'loyalty_providers.card_color'
    );

  return cards;
}

/**
 * Add a loyalty card
 * Hashes the card number, stores only last 4 digits
 */
async function addCard(profileId, { loyalty_provider_id, card_number }) {
  if (!card_number || card_number.length < 4) {
    throw new AppError('Invalid card number.', 400);
  }

  // Check provider exists
  const provider = await db('loyalty_providers').where({ id: loyalty_provider_id, is_active: true }).first();
  if (!provider) {
    throw new AppError('Loyalty provider not found.', 404);
  }

  // Check for duplicate
  const existing = await db('customer_loyalty_cards')
    .where({ profile_id: profileId, loyalty_provider_id })
    .first();
  if (existing) {
    throw new AppError('You already have a card with this provider.', 409);
  }

  const cardLastFour = card_number.slice(-4);
  const cardHash = crypto.createHash('sha256').update(card_number).digest('hex');

  const [card] = await db('customer_loyalty_cards').insert({
    profile_id: profileId,
    loyalty_provider_id,
    card_number_hash: cardHash,
    card_last_four: cardLastFour,
  }).returning('*');

  return {
    id: card.id,
    card_last_four: cardLastFour,
    provider_name: provider.name,
    provider_logo: provider.logo_url,
  };
}

/**
 * Remove a loyalty card
 */
async function removeCard(profileId, cardId) {
  const card = await db('customer_loyalty_cards')
    .where({ id: cardId, profile_id: profileId })
    .first();
  if (!card) {
    throw new AppError('Card not found.', 404);
  }

  await db('customer_loyalty_cards').where({ id: cardId }).update({ is_active: false });
  return { message: 'Card removed' };
}

/**
 * List available loyalty providers
 */
async function getProviders() {
  return db('loyalty_providers').where({ is_active: true }).orderBy('name');
}

/**
 * Check if customer has loyalty card for a given store
 */
async function hasLoyaltyForStore(profileId, storeId) {
  const card = await db('customer_loyalty_cards')
    .join('loyalty_providers', 'loyalty_providers.id', 'customer_loyalty_cards.loyalty_provider_id')
    .where('customer_loyalty_cards.profile_id', profileId)
    .where('customer_loyalty_cards.is_active', true)
    .where('loyalty_providers.slug', storeId) // or join through store if provider mapped
    .first();

  return !!card;
}

export default {
  getMyCards,
  addCard,
  removeCard,
  getProviders,
  hasLoyaltyForStore,
};
