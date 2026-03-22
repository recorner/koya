import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MpesaAdapter,
  STKPushInput,
  STKPushResult,
} from './mpesa-adapter.interface';

interface DarajaOAuthResponse {
  access_token: string;
  expires_in: string;
}

interface DarajaSTKResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

@Injectable()
export class DarajaMpesaAdapter implements MpesaAdapter {
  private readonly logger = new Logger(DarajaMpesaAdapter.name);
  private readonly baseUrl: string;
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly passkey: string;
  private readonly shortcode: string;
  private readonly callbackUrl: string;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    const env = this.config.get<string>('MPESA_ENVIRONMENT', 'sandbox');
    this.baseUrl =
      env === 'production'
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';

    this.consumerKey = this.config.get<string>('MPESA_CONSUMER_KEY', '');
    this.consumerSecret = this.config.get<string>('MPESA_CONSUMER_SECRET', '');
    this.passkey = this.config.get<string>('MPESA_PASSKEY', '');
    this.shortcode = this.config.get<string>('MPESA_SHORTCODE', '174379');
    this.callbackUrl = this.config.get<string>(
      'MPESA_CALLBACK_URL',
      'https://api.koyabank.com/api/v1/payments/mpesa/callback',
    );
  }

  async initiateSTKPush(input: STKPushInput): Promise<STKPushResult> {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = Buffer.from(
      `${this.shortcode}${this.passkey}${timestamp}`,
    ).toString('base64');

    // Normalize phone: strip + prefix, ensure 254 format
    const phone = this.normalizePhone(input.phoneE164);

    const body = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(input.amountKES),
      PartyA: phone,
      PartyB: this.shortcode,
      PhoneNumber: phone,
      CallBackURL: this.callbackUrl,
      AccountReference: input.accountReference,
      TransactionDesc: input.transactionDesc,
    };

    this.logger.log(
      `Initiating STK push: phone=${phone} amount=${input.amountKES} ref=${input.accountReference}`,
    );

    const response = await fetch(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`STK push failed: ${response.status} ${errorText}`);
      return {
        success: false,
        merchantRequestId: '',
        checkoutRequestId: '',
        responseDescription: `Daraja API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as DarajaSTKResponse;

    if (data.ResponseCode !== '0') {
      this.logger.error(
        `STK push rejected: ${data.ResponseCode} ${data.ResponseDescription}`,
      );
      return {
        success: false,
        merchantRequestId: data.MerchantRequestID ?? '',
        checkoutRequestId: data.CheckoutRequestID ?? '',
        responseDescription: data.ResponseDescription,
      };
    }

    this.logger.log(
      `STK push success: MerchantRequestID=${data.MerchantRequestID} CheckoutRequestID=${data.CheckoutRequestID}`,
    );

    return {
      success: true,
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseDescription: data.ResponseDescription,
    };
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`,
    ).toString('base64');

    const response = await fetch(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Daraja OAuth failed: ${response.status} ${errorText}`,
      );
    }

    const data = (await response.json()) as DarajaOAuthResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + parseInt(data.expires_in, 10) * 1000;

    this.logger.log('Daraja OAuth token refreshed');
    return this.cachedToken;
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private normalizePhone(phoneE164: string): string {
    // Remove + prefix if present
    let phone = phoneE164.replace(/^\+/, '');
    // If starts with 0, replace with 254
    if (phone.startsWith('0')) {
      phone = `254${phone.slice(1)}`;
    }
    return phone;
  }
}
