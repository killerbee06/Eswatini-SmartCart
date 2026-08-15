/**
 * Age Service
 * 
 * Server-side age calculation and eligibility checking.
 * All age verification MUST happen on the backend — never trust the frontend.
 */

import db from '../config/knex.js';

/**
 * Calculate age from date of birth
 * @param {string|Date} dateOfBirth - ISO date string or Date object
 * @returns {number} Age in whole years
 */
function calculateAge(dateOfBirth) {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    throw new Error('Invalid date of birth');
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  // If birthday hasn't occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Check if a user is eligible to purchase an age-restricted product
 * @param {string} profileId - User's profile ID
 * @param {Object} product - Product with age_restricted and minimum_age fields
 * @returns {Object} { eligible: boolean, reason?: string, age?: number, requiredAge?: number }
 */
async function isEligibleForProduct(profileId, product) {
  // Non-restricted products are always eligible
  if (!product.age_restricted) {
    return { eligible: true };
  }

  // Fetch profile to get DOB
  const profile = await db('profiles').where('id', profileId).first();
  if (!profile) {
    return { eligible: false, reason: 'Profile not found' };
  }

  if (!profile.date_of_birth) {
    return {
      eligible: false,
      reason: 'Date of birth required for age-restricted products. Please update your profile.',
      requiresProfileUpdate: true,
    };
  }

  const age = calculateAge(profile.date_of_birth);
  const requiredAge = product.minimum_age || 18; // Default to 18 if not set

  if (age < requiredAge) {
    return {
      eligible: false,
      reason: `You must be at least ${requiredAge} years old to purchase this product.`,
      age,
      requiredAge,
    };
  }

  return { eligible: true, age, requiredAge };
}

/**
 * Check if a user is eligible for ALL products in an order
 * @param {string} profileId - User's profile ID
 * @param {Array} items - Order items with product details
 * @returns {Object} { eligible: boolean, ineligibleItems?: Array }
 */
async function isEligibleForOrder(profileId, items) {
  const ineligibleItems = [];

  for (const item of items) {
    if (item.age_restricted) {
      const check = await isEligibleForProduct(profileId, item);
      if (!check.eligible) {
        ineligibleItems.push({
          productId: item.product_id || item.id,
          productName: item.name,
          reason: check.reason,
          requiredAge: check.requiredAge,
        });
      }
    }
  }

  return {
    eligible: ineligibleItems.length === 0,
    ineligibleItems: ineligibleItems.length > 0 ? ineligibleItems : undefined,
  };
}

/**
 * Get platform default minimum age for restricted products
 * @returns {number} Minimum age (default 18)
 */
async function getPlatformMinimumAge() {
  const setting = await db('system_settings')
    .where('key', 'minimum_age_for_restricted')
    .first();
  return setting ? parseInt(setting.value, 10) : 18;
}

/**
 * Verify age at delivery (for driver use)
 * Returns only YES/NO — never exposes the customer's DOB to the driver
 * @param {string} profileId - Customer's profile ID
 * @param {number} requiredAge - Minimum age required
 * @returns {Object} { verified: boolean }
 */
async function verifyAgeAtDelivery(profileId, requiredAge) {
  const profile = await db('profiles').where('id', profileId).first();
  if (!profile || !profile.date_of_birth) {
    return { verified: false };
  }

  const age = calculateAge(profile.date_of_birth);
  return { verified: age >= requiredAge };
}

export default {
  calculateAge,
  isEligibleForProduct,
  isEligibleForOrder,
  getPlatformMinimumAge,
  verifyAgeAtDelivery,
};
