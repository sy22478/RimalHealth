/**
 * POST /api/patient/pharmacies/select
 * Patient selects a pharmacy from NPI search results.
 * Upserts into local Pharmacy table and links to PatientProfile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { validateAddress } from '@/lib/integrations/location';

const selectPharmacySchema = z.object({
  npiNumber: z.string().min(1, { message: 'NPI number is required' }),
  name: z.string().min(1, { message: 'Pharmacy name is required' }),
  address: z.string().min(1, { message: 'Address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  state: z.string().min(1, { message: 'State is required' }),
  zipCode: z.string().min(1, { message: 'ZIP code is required' }),
  phone: z.string(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const body = await request.json();
    const parsed = selectPharmacySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pharmacy data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { npiNumber, name, address, city, state, zipCode, phone } = parsed.data;
    const ncpdpId = `NPI-${npiNumber}`;

    // Geocode the pharmacy address via Amazon Location Service so we can
    // sort future searches by proximity to the patient. Non-blocking: if the
    // service fails or returns no coords, we still persist the pharmacy.
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const geocode = await validateAddress({ street: address, city, state, zip: zipCode });
      const top = geocode.suggestions[0];
      if (top && typeof top.latitude === 'number' && typeof top.longitude === 'number') {
        latitude = top.latitude;
        longitude = top.longitude;
      } else if (geocode.error) {
        console.warn('Pharmacy geocoding returned no coordinates:', geocode.error);
      }
    } catch (geoError) {
      console.warn(
        'Pharmacy geocoding failed, proceeding without coordinates:',
        geoError instanceof Error ? geoError.message : 'Unknown error'
      );
    }

    // Upsert pharmacy into local cache table
    const pharmacy = await prisma.pharmacy.upsert({
      where: { ncpdpId },
      create: {
        ncpdpId,
        npiNumber,
        name,
        phone: phone || null,
        address,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        isActive: true,
      },
      update: {
        name,
        phone: phone || null,
        address,
        city,
        state,
        zipCode,
        ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
      },
    });

    // Link pharmacy to patient profile
    await prisma.patientProfile.update({
      where: { userId },
      data: { preferredPharmacyId: pharmacy.id },
    });

    return NextResponse.json({
      success: true,
      pharmacy: {
        id: pharmacy.id,
        name: pharmacy.name,
        address: pharmacy.address,
        city: pharmacy.city,
        state: pharmacy.state,
        zipCode: pharmacy.zipCode,
        phone: pharmacy.phone,
      },
    });
  } catch (error) {
    console.error('Pharmacy select error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to select pharmacy', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
