/**
 * Physician Check-in Review Page
 *
 * Lists SUBMITTED GLP-1 check-ins awaiting review and lets a physician open one
 * to read the patient's responses and mark it reviewed.
 *
 * @module app/physician/(portal)/check-ins/page
 */
import * as React from 'react';
import { Metadata } from 'next';
import CheckInReviewClient from './CheckInReviewClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Check-in Review | Physician Portal',
  description: 'Review submitted weight-management check-ins.',
};

export default function CheckInReviewPage(): React.ReactElement {
  return <CheckInReviewClient />;
}
