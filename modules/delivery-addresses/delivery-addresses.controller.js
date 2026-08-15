/**
 * Delivery Addresses Controller
 */

import addressService from '../../services/delivery-address.service.js';
import { success } from '../../shared/utils.js';

/** GET /api/v1/addresses */
export async function listAddresses(req, res, next) {
  try {
    const addresses = await addressService.getAddresses(req.user.id);
    return success(res, addresses);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/addresses */
export async function addAddress(req, res, next) {
  try {
    const address = await addressService.addAddress(req.user.id, req.body);
    return success(res, address, 'Address added', 201);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/addresses/:id */
export async function updateAddress(req, res, next) {
  try {
    const address = await addressService.updateAddress(req.user.id, req.params.id, req.body);
    return success(res, address, 'Address updated');
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/addresses/:id */
export async function deleteAddress(req, res, next) {
  try {
    const result = await addressService.deleteAddress(req.user.id, req.params.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
