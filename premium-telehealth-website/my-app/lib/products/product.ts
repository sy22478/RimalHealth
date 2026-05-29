/**
 * Product catalog helpers (multi-treatment foundation, Phase 1).
 *
 * A Product is the spine for supporting multiple treatments. AUD is the first
 * treatment ("alcohol-aud"); GLP-1 weight management is the second
 * ("weight-management"). Intake and Prescription FK into Product.
 *
 * These helpers resolve a product slug to its id and degrade gracefully: if the
 * Product table is empty or unmigrated, they return null. Callers store the
 * nullable productId, so existing AUD behavior is preserved (the columns are
 * nullable and the where clauses simply match `productId: null`).
 */
import { prisma } from '@/lib/db/prisma';

/** The default treatment when no product is specified — existing AUD flow. */
export const DEFAULT_PRODUCT_SLUG = 'alcohol-aud';

/** Slug for the GLP-1 weight-management treatment (live form arrives Phase 2). */
export const WEIGHT_MANAGEMENT_SLUG = 'weight-management';

/**
 * Resolve a product slug to its id, defaulting to the AUD product.
 *
 * Returns null when the requested slug (and the default fallback) cannot be
 * found — e.g. the Product table has not been seeded/migrated yet. Returning
 * null keeps the intake flow behavior-neutral on un-migrated databases.
 */
export async function resolveProductId(
  slug?: string | null
): Promise<string | null> {
  const requested = slug?.trim() || DEFAULT_PRODUCT_SLUG;

  try {
    const product = await prisma.product.findUnique({
      where: { slug: requested },
      select: { id: true },
    });
    if (product) return product.id;

    // Unknown slug — fall back to the default AUD product if it exists.
    if (requested !== DEFAULT_PRODUCT_SLUG) {
      const fallback = await prisma.product.findUnique({
        where: { slug: DEFAULT_PRODUCT_SLUG },
        select: { id: true },
      });
      return fallback?.id ?? null;
    }

    return null;
  } catch (error) {
    // The Product table may not exist yet on un-migrated databases. Returning
    // null keeps callers behavior-neutral (productId stays null) instead of
    // throwing and breaking the existing AUD intake flow.
    console.error(
      '[resolveProductId] Failed to resolve product, defaulting to null:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}
