import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateGuestRef,
  normalizeDocumentNumber,
  normalizeKenyaPhone,
} from '../common/validation.utils';

@Injectable()
export class GuestProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find or create a guest profile by canonical identity
   * (country_code + document_type + document_number_normalized)
   */
  async findOrCreate(input: {
    fullName: string;
    countryCode: string;
    documentType: 'NATIONAL_ID' | 'PASSPORT' | 'ALIEN_ID' | 'MILITARY_ID';
    documentNumber: string;
    phone: string;
    email?: string;
  }) {
    const normalizedDoc = normalizeDocumentNumber(input.documentNumber);
    const phoneE164 = normalizeKenyaPhone(input.phone);

    // Check for existing guest by canonical identity
    const existing = await this.prisma.guestProfile.findUnique({
      where: {
        identity_dedupe: {
          countryCode: input.countryCode,
          documentType: input.documentType,
          documentNumberNormalized: normalizedDoc,
        },
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ConflictException('This identity has been blocked');
      }
      return existing;
    }

    // Create new guest profile
    const guestRef = generateGuestRef();

    return this.prisma.guestProfile.create({
      data: {
        guestRef,
        fullName: input.fullName,
        countryCode: input.countryCode,
        documentType: input.documentType,
        documentNumberNormalized: normalizedDoc,
        phoneE164,
        email: input.email ?? null,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.guestProfile.findUnique({ where: { id } });
  }

  async findByGuestRef(guestRef: string) {
    return this.prisma.guestProfile.findUnique({ where: { guestRef } });
  }
}
