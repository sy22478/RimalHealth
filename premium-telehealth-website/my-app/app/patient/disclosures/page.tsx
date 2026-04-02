'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface Disclosure {
  id: string;
  date: string;
  accessorRole: string;
  recipient: string;
  purpose: string;
  dataCategories: string[];
  legalBasis: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export default function DisclosuresPage() {
  const [disclosures, setDisclosures] = React.useState<Disclosure[]>([]);
  const [pagination, setPagination] = React.useState<Pagination | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    async function fetchDisclosures() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/patient/disclosures?page=${page}&limit=20`, { credentials: 'include' });
        if (!res.ok) {
          throw new Error('Failed to fetch disclosures');
        }
        const data = await res.json();
        setDisclosures(data.disclosures);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load disclosures');
      } finally {
        setLoading(false);
      }
    }

    fetchDisclosures();
  }, [page]);

  function handleExport() {
    if (disclosures.length === 0) return;

    const lines = [
      'RIMAL HEALTH — ACCOUNTING OF DISCLOSURES',
      `Generated: ${new Date().toISOString()}`,
      '',
      'Date | Recipient | Purpose | Data Categories | Legal Basis',
      '------|-----------|---------|-----------------|------------',
      ...disclosures.map((d) =>
        `${new Date(d.date).toLocaleDateString()} | ${d.recipient} | ${d.purpose} | ${d.dataCategories.join(', ')} | ${d.legalBasis}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disclosures-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting of Disclosures</h1>
          <p className="text-sm text-gray-500 mt-1">
            Under 42 CFR Part 2, you have the right to see who has accessed your
            substance use disorder treatment records.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={disclosures.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Loading disclosures...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-8 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && disclosures.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Eye className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No disclosures found</p>
            <p className="text-sm mt-1">
              When your treatment records are accessed, it will be logged here.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && disclosures.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Disclosure Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Recipient</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Purpose</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Legal Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disclosures.map((d) => (
                      <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">
                          {new Date(d.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{d.recipient}</td>
                        <td className="px-4 py-3 text-gray-700">{d.purpose}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {d.dataCategories.map((cat) => (
                              <span
                                key={cat}
                                className="bg-ocean-50 text-ocean-700 text-xs px-2 py-0.5 rounded-full"
                              >
                                {cat.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {d.legalBasis.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3 p-4">
                {disclosures.map((d) => (
                  <div key={d.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(d.date).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {d.legalBasis.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{d.recipient}</p>
                    <p className="text-sm text-gray-500">{d.purpose}</p>
                    <div className="flex flex-wrap gap-1">
                      {d.dataCategories.map((cat) => (
                        <span key={cat} className="bg-ocean-50 text-ocean-700 text-xs px-2 py-0.5 rounded-full">
                          {cat.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasMore}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
