/**
 * Reviews Page — Redirect to Patient Queue
 *
 * The reviews functionality has been consolidated into /physician/queue.
 * This page redirects for backwards compatibility.
 *
 * @module app/physician/reviews/page
 */

import { redirect } from 'next/navigation';

export default function ReviewsPage(): never {
  redirect('/physician/queue');
}
