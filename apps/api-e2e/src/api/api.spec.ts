import axios from 'axios';

describe('Health check', () => {
  it('GET /api/v1/health should return ok', async () => {
    const res = await axios.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.service).toBe('koya-api');
    expect(res.data.timestamp).toBeDefined();
  });
});
