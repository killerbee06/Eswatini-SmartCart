/**
 * Categories Controller
 *
 * REST endpoints for product category management:
 *  - GET    /          – list all categories (public)
 *  - GET    /:id       – get single category with children
 *  - POST   /          – create category (admin)
 *  - PATCH  /:id       – update category (admin)
 *  - DELETE /:id       – delete category (admin)
 */

import db from '../../config/knex.js';
import { success, created } from '../../shared/utils.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

/**
 * GET /api/v1/categories
 * List all active categories (public).
 */
export async function listCategories(req, res, next) {
  try {
    const categories = await db('categories')
      .where({ is_active: true })
      .orderBy('name', 'asc');

    // Build tree structure
    const tree = _buildTree(categories);
    return success(res, tree);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/categories/:id
 * Get single category with its children.
 */
export async function getCategory(req, res, next) {
  try {
    const category = await db('categories').where({ id: req.params.id }).first();
    if (!category) throw new NotFoundError('Category');

    const children = await db('categories')
      .where({ parent_id: category.id, is_active: true })
      .orderBy('name', 'asc');

    // Count products in this category
    const [{ count: productCount }] = await db('products')
      .where({ category_id: category.id })
      .count('id as count');

    return success(res, {
      ...category,
      children,
      product_count: parseInt(productCount, 10),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/categories
 * Create a new category (admin only).
 */
export async function createCategory(req, res, next) {
  try {
    const { name, parent_id, is_active } = req.body;

    // Verify parent exists if provided
    if (parent_id) {
      const parent = await db('categories').where({ id: parent_id }).first();
      if (!parent) throw new AppError('Parent category not found.', 400);
    }

    // Check for duplicate name at same level
    const existing = await db('categories')
      .where({ name, parent_id: parent_id || null })
      .first();
    if (existing) {
      throw new AppError('A category with this name already exists at this level.', 409);
    }

    const [category] = await db('categories').insert({
      name,
      parent_id: parent_id || null,
      is_active: is_active !== undefined ? is_active : true,
    }).returning('*');

    return created(res, category, 'Category created');
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/categories/:id
 * Update a category (admin only).
 */
export async function updateCategory(req, res, next) {
  try {
    const category = await db('categories').where({ id: req.params.id }).first();
    if (!category) throw new NotFoundError('Category');

    const allowed = ['name', 'parent_id', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update.', 400);
    }

    // Prevent circular reference
    if (updates.parent_id === category.id) {
      throw new AppError('A category cannot be its own parent.', 400);
    }

    updates.updated_at = new Date();

    const [updated] = await db('categories')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    return success(res, updated, 'Category updated');
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/categories/:id
 * Delete a category (admin only). Reassigns products to null.
 */
export async function deleteCategory(req, res, next) {
  try {
    const category = await db('categories').where({ id: req.params.id }).first();
    if (!category) throw new NotFoundError('Category');

    // Check for children
    const children = await db('categories').where({ parent_id: category.id }).count('id as count');
    if (parseInt(children[0].count, 10) > 0) {
      throw new AppError('Cannot delete category with children. Remove or reassign them first.', 400);
    }

    // Unassign products
    await db('products').where({ category_id: category.id }).update({ category_id: null });
    await db('categories').where({ id: req.params.id }).del();

    return success(res, null, 'Category deleted');
  } catch (err) {
    next(err);
  }
}

// ── Internal helpers ───────────────────────────────────────

function _buildTree(categories, parentId = null) {
  return categories
    .filter((c) => c.parent_id === parentId)
    .map((c) => ({
      ...c,
      children: _buildTree(categories, c.id),
    }));
}
