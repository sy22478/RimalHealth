import { NextResponse } from 'next/server';

function notFound(): NextResponse {
  return NextResponse.json(
    { error: 'Not Found', code: 'NOT_FOUND' },
    { status: 404 }
  );
}

export async function GET(): Promise<NextResponse> {
  return notFound();
}

export async function POST(): Promise<NextResponse> {
  return notFound();
}

export async function PUT(): Promise<NextResponse> {
  return notFound();
}

export async function DELETE(): Promise<NextResponse> {
  return notFound();
}

export async function PATCH(): Promise<NextResponse> {
  return notFound();
}
