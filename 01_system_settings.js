/**
 * Seed system_settings — configurable platform values.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  await knex('system_settings').del();

  await knex('system_settings').insert([
    {
      key: 'platform_commission_rate',
      value: 0.03,
      description: 'Default platform commission rate (3%)',
      updated_by: null,
    },
    {
      key: 'default_delivery_fee',
      value: 25.00,
      description: 'Default delivery fee in Eswatini Emalangeni',
      updated_by: null,
    },
    {
      key: 'min_order_amount',
      value: 50.00,
      description: 'Minimum order amount for checkout',
      updated_by: null,
    },
    {
      key: 'min_payout_amount',
      value: 50.00,
      description: 'Minimum payout amount for merchant batch generation',
      updated_by: null,
    },
    {
      key: 'otp_expiry_minutes',
      value: 15,
      description: 'OTP expiry time in minutes',
      updated_by: null,
    },
    {
      key: 'otp_max_attempts',
      value: 3,
      description: 'Maximum OTP verification attempts',
      updated_by: null,
    },
  ]);
}
