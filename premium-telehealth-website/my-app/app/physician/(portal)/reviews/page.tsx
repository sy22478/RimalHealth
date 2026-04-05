'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, AlertCircle, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

interface CompletedReview {
  intakeId: string;
  patientId: string;
  patientName: string;
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
  reviewedAt: string;
  clinicalNotes: string | null;
  physicianName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function DecisionBadge({ decision }: { decision: string }) {
  switch (decision) {
    case 'APPROVED':
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Approved
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Rejected
        </Badge>
      );
    case 'NEEDS_INFO':
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />
          Needs Info
        </Badge>
      );
    default:
      return <Badge variant="secondary">{decision}</Badge>;
  }
}

export default function ReviewHistoryPage() {
  const [reviews, setReviews] = useState<CompletedReview[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/physician/reviews?page=${page}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch review history');
      const data = await res.json();
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(1);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <History className="w-6 h-6" />
          Review History
        </h1>
        <p className="text-muted-foreground mt-1">
          Completed intake reviews — approved, rejected, and needs info.
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4 text-red-700">
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Completed Reviews</CardTitle>
          <CardDescription>
            {pagination.total} review{pagination.total !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : reviews.length === 0 ? (
            <EmptyState
              title="No completed reviews"
              description="Reviews will appear here once intakes have been reviewed."
              icon="search"
              className="py-12"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Date Reviewed</TableHead>
                      <TableHead>Physician Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => (
                      <TableRow key={review.intakeId}>
                        <TableCell>
                          <Link
                            href={`/physician/patients/${review.patientId}`}
                            className="font-medium text-ocean-600 hover:underline"
                          >
                            {review.patientName}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DecisionBadge decision={review.decision} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(review.reviewedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="text-sm text-muted-foreground truncate block">
                            {review.clinicalNotes || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/physician/queue/${review.intakeId}`}>
                            <Button variant="ghost" size="sm">
                              View Intake
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchReviews(pagination.page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchReviews(pagination.page + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
