/**
 * Physician Titration Review Page
 *
 * Lists GLP-1 titration steps ready for a physician-reviewed dose advance and
 * lets a physician approve the advance (which raises the patient's dose).
 *
 * @module app/physician/(portal)/titration/page
 */
import * as React from 'react';
import { Metadata } from 'next';
import TitrationReviewClient from './TitrationReviewClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Titration Review | Physician Portal',
  description: 'Review and approve GLP-1 dose advances.',
};

export default function TitrationReviewPage(): React.ReactElement {
  return <TitrationReviewClient />;
}
