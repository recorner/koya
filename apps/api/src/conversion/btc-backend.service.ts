import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  BTC_BACKEND_PROVIDER,
  BtcBackendProvider,
} from '../providers/btc-backend.interface';
import { detectBtcAddressNetwork, validateBtcAddressForNetwork } from '../common/btc-address.utils';
import { randomUUID } from 'crypto';

@Injectable()
export class BtcBackendService {
  private readonly logger = new Logger(BtcBackendService.name);
  private readonly btcNetwork: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(BTC_BACKEND_PROVIDER) private readonly btcBackend: BtcBackendProvider,
  ) {
    this.btcNetwork = this.config.get<string>('BTC_NETWORK', 'bitcoin');
  }

  async issueDepositAddress(input: {
    businessContextType: string;
    businessContextRef: string;
    conversionSessionId?: string;
    externalId?: string;
    walletName?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (input.conversionSessionId) {
      const session = await this.prisma.conversionSession.findUnique({
        where: { id: input.conversionSessionId },
      });
      if (!session) {
        throw new NotFoundException(`Conversion session not found: ${input.conversionSessionId}`);
      }
    }

    const externalId = input.externalId
      ?? `koya:deposit:${input.businessContextType}:${input.businessContextRef}:${randomUUID()}`;

    const existing = await this.prisma.btcDepositAddress.findUnique({
      where: { externalId },
    });

    if (existing) {
      return {
        id: existing.id,
        address: existing.address,
        externalId: existing.externalId,
        backend: existing.backend,
        network: existing.btcNetwork,
        walletName: existing.walletName,
      };
    }

    const metadata = {
      businessContextType: input.businessContextType,
      businessContextRef: input.businessContextRef,
      conversionSessionId: input.conversionSessionId,
      ...(input.metadata ?? {}),
    };

    const generated = await this.btcBackend.generateDepositAddress({
      walletName: input.walletName,
      externalId,
      metadata,
    });

    const validation = validateBtcAddressForNetwork(generated.address, this.btcNetwork);
    if (!validation.valid) {
      this.logger.error(
        `Rejected generated deposit address due to network mismatch (configured=${this.btcNetwork}, detected=${validation.detectedNetwork ?? 'unknown'})`,
      );
      throw new BadRequestException(
        `Generated BTC address does not match configured network (${this.btcNetwork})`,
      );
    }

    const walletName = input.walletName ?? this.config.get<string>('BRIA_WALLET_NAME') ?? undefined;

    const record = await this.prisma.btcDepositAddress.create({
      data: {
        backend: this.btcBackend.backend,
        btcNetwork: this.btcNetwork,
        walletName,
        address: generated.address,
        externalId,
        businessContextType: input.businessContextType,
        businessContextRef: input.businessContextRef,
        conversionSessionId: input.conversionSessionId,
        metadataJson: metadata,
      },
    });

    return {
      id: record.id,
      address: record.address,
      externalId: record.externalId,
      backend: record.backend,
      network: record.btcNetwork,
      walletName: record.walletName,
      detectedNetwork: detectBtcAddressNetwork(record.address),
    };
  }

  async getDepositAddressByExternalId(externalId: string) {
    const record = await this.prisma.btcDepositAddress.findUnique({
      where: { externalId },
    });

    if (!record) {
      throw new NotFoundException(`Deposit address not found for externalId=${externalId}`);
    }

    return {
      ...record,
      detectedNetwork: detectBtcAddressNetwork(record.address),
    };
  }

  backendHealth() {
    return this.btcBackend.healthMetadata();
  }
}
