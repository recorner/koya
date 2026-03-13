import axios, { AxiosError } from 'axios';

const BASE = '/api/v1/guest-conversion';

describe('Guest Conversion API (E2E)', () => {
  describe('POST /quote', () => {
    it('should create a KES→BTC quote', async () => {
      const res = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      expect(res.status).toBe(201);
      expect(res.data.quoteId).toBeDefined();
      expect(res.data.sourceAsset).toBe('KES');
      expect(res.data.targetAsset).toBe('BTC');
      expect(res.data.sourceAmount).toBe('1000');
      expect(parseFloat(res.data.targetAmount)).toBeGreaterThan(0);
      expect(res.data.rate).toBeDefined();
      expect(res.data.fee).toBeDefined();
      expect(res.data.expiresAt).toBeDefined();
    });

    it('should reject unsupported route', async () => {
      try {
        await axios.post(`${BASE}/quote`, {
          sourceAsset: 'KES',
          targetAsset: 'USDC',
          sourceAmount: '1000',
          channel: 'WEB',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should reject missing fields', async () => {
      try {
        await axios.post(`${BASE}/quote`, { sourceAsset: 'KES' });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBe(400);
      }
    });

    it('should reject amount below minimum', async () => {
      try {
        await axios.post(`${BASE}/quote`, {
          sourceAsset: 'KES',
          targetAsset: 'BTC',
          sourceAmount: '50',
          channel: 'WEB',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('POST /session', () => {
    it('should create a session from a valid quote', async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      const res = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });

      expect(res.status).toBe(201);
      expect(res.data.sessionId).toBeDefined();
      expect(res.data.currentState).toBe('IDENTITY_PENDING');
      expect(res.data.referenceCode).toMatch(/^KYA-[A-F0-9]{8}$/);
    });

    it('should reject a non-existent quote', async () => {
      try {
        await axios.post(`${BASE}/session`, {
          quoteId: '00000000-0000-0000-0000-000000000000',
          channel: 'WEB',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should reject double session creation for same quote', async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });

      try {
        await axios.post(`${BASE}/session`, {
          quoteId: quoteRes.data.quoteId,
          channel: 'WEB',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('POST /:sessionId/identity', () => {
    let sessionId: string;

    beforeEach(async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const sessionRes = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });
      sessionId = sessionRes.data.sessionId;
    });

    it('should submit identity and pass compliance', async () => {
      const res = await axios.post(`${BASE}/${sessionId}/identity`, {
        fullName: 'E2E Test User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: `E2E${Date.now()}`,
        phone: '0712345678',
        email: 'e2e@koya.test',
      });

      expect(res.status).toBe(201);
      expect(res.data.compliancePassed).toBe(true);
      expect(res.data.currentState).toBe('PAYOUT_DETAILS_PENDING');
      expect(res.data.guestRef).toBeDefined();
    });

    it('should fail compliance for FAIL-prefixed docs', async () => {
      const res = await axios.post(`${BASE}/${sessionId}/identity`, {
        fullName: 'Bad Actor',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'FAILXXX',
        phone: '0712999999',
      });

      expect(res.status).toBe(201);
      expect(res.data.compliancePassed).toBe(false);
    });

    it('should reject missing required fields', async () => {
      try {
        await axios.post(`${BASE}/${sessionId}/identity`, {
          fullName: 'Incomplete',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBe(400);
      }
    });
  });

  describe('POST /:sessionId/payout-details', () => {
    let sessionId: string;

    beforeEach(async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const sessionRes = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });
      sessionId = sessionRes.data.sessionId;

      await axios.post(`${BASE}/${sessionId}/identity`, {
        fullName: 'Payout Test',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: `PAY${Date.now()}`,
        phone: '0712555555',
      });
    });

    it('should accept valid BTC address', async () => {
      const res = await axios.post(`${BASE}/${sessionId}/payout-details`, {
        btcAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      });

      expect(res.status).toBe(201);
      expect(res.data.currentState).toBe('PAYMENT_PENDING');
    });

    it('should reject invalid BTC address', async () => {
      try {
        await axios.post(`${BASE}/${sessionId}/payout-details`, {
          btcAddress: 'not-a-btc-address',
        });
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('POST /:sessionId/initiate-payment', () => {
    let sessionId: string;

    beforeEach(async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const sessionRes = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });
      sessionId = sessionRes.data.sessionId;

      await axios.post(`${BASE}/${sessionId}/identity`, {
        fullName: 'Payment Test',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: `PMNT${Date.now()}`,
        phone: '0712666666',
      });

      await axios.post(`${BASE}/${sessionId}/payout-details`, {
        btcAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      });
    });

    it('should initiate M-Pesa STK push', async () => {
      const res = await axios.post(`${BASE}/${sessionId}/initiate-payment`);

      expect(res.status).toBe(201);
      expect(res.data.currentState).toBe('PAYMENT_PENDING');
      expect(res.data.checkoutRequestId).toBeDefined();
      expect(res.data.phone).toBeDefined();
    });
  });

  describe('GET /:sessionId/status', () => {
    it('should return current session status', async () => {
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const sessionRes = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });

      const res = await axios.get(
        `${BASE}/${sessionRes.data.sessionId}/status`,
      );

      expect(res.status).toBe(200);
      expect(res.data.sessionId).toBe(sessionRes.data.sessionId);
      expect(res.data.currentState).toBe('IDENTITY_PENDING');
      expect(res.data.referenceCode).toBeDefined();
      expect(res.data.sourceAsset).toBe('KES');
      expect(res.data.targetAsset).toBe('BTC');
    });

    it('should return error for non-existent session', async () => {
      try {
        await axios.get(`${BASE}/00000000-0000-0000-0000-000000000000/status`);
        fail('Expected request to fail');
      } catch (err) {
        const error = err as AxiosError;
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Full conversion flow', () => {
    it('should complete the entire guest conversion flow', async () => {
      // Step 1: Create quote
      const quoteRes = await axios.post(`${BASE}/quote`, {
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '5000',
        channel: 'WEB',
      });
      expect(quoteRes.data.quoteId).toBeDefined();

      // Step 2: Create session
      const sessionRes = await axios.post(`${BASE}/session`, {
        quoteId: quoteRes.data.quoteId,
        channel: 'WEB',
      });
      expect(sessionRes.data.currentState).toBe('IDENTITY_PENDING');
      const { sessionId } = sessionRes.data;

      // Step 3: Submit identity
      const identityRes = await axios.post(`${BASE}/${sessionId}/identity`, {
        fullName: 'Full Flow User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: `FLOW${Date.now()}`,
        phone: '0712777777',
        email: 'flow@koya.test',
      });
      expect(identityRes.data.currentState).toBe('PAYOUT_DETAILS_PENDING');
      expect(identityRes.data.compliancePassed).toBe(true);

      // Step 4: Submit payout details
      const payoutRes = await axios.post(
        `${BASE}/${sessionId}/payout-details`,
        { btcAddress: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' },
      );
      expect(payoutRes.data.currentState).toBe('PAYMENT_PENDING');

      // Step 5: Initiate payment (STK push)
      const paymentRes = await axios.post(
        `${BASE}/${sessionId}/initiate-payment`,
      );
      expect(paymentRes.data.currentState).toBe('PAYMENT_PENDING');
      expect(paymentRes.data.checkoutRequestId).toBeDefined();

      // Step 6: Check status
      const statusRes = await axios.get(`${BASE}/${sessionId}/status`);
      expect(statusRes.data.currentState).toBe('PAYMENT_PENDING');
      expect(statusRes.data.sourceAsset).toBe('KES');
      expect(statusRes.data.targetAsset).toBe('BTC');
    });
  });
});
