import { AbstractAuthProvider } from 'tinacms';

/**
 * Frontend auth provider for TinaCMS admin UI.
 * Shows username/password login form, authenticates via POST to /api/tina/auth/login,
 * stores JWT in memory for the session.
 */

type TokenObject = {
  access_token?: string;
  id_token: string;
  refresh_token?: string;
};

type LoginStrategy = 'UsernamePassword' | 'Redirect' | 'LoginScreen';

let _token: TokenObject | null = null;

export class KoyaAuthProvider extends AbstractAuthProvider {
  getLoginStrategy(): LoginStrategy {
    return 'UsernamePassword';
  }

  async authenticate(
    props?: Record<string, string>
  ): Promise<TokenObject | null> {
    const username = props?.['username'];
    const password = props?.['password'];

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const res = await fetch('/api/tina/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Authentication failed');
    }

    const data = await res.json();
    _token = {
      id_token: data.token,
      access_token: data.token,
    };
    return _token;
  }

  async getToken(): Promise<TokenObject | null> {
    return _token;
  }

  async getUser(): Promise<boolean> {
    if (!_token?.id_token) return false;

    // Decode JWT payload to check expiry (without verifying signature — that's the backend's job)
    try {
      const parts = _token.id_token.split('.');
      const payload = JSON.parse(atob(parts[1] ?? ''));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        _token = null;
        return false;
      }
      return true;
    } catch {
      _token = null;
      return false;
    }
  }

  async logout(): Promise<void> {
    _token = null;
  }
}
