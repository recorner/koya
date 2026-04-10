import type { IncomingMessage, ServerResponse } from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { BackendAuthProvider } from '@tinacms/datalayer';
import users from './users.json';

/**
 * Backend auth provider for TinaCMS self-hosted.
 * Verifies JWT Bearer tokens on GraphQL requests and exposes
 * an /auth/login route that validates username/password against users.json.
 */

interface User {
  username: string;
  passwordHash: string;
  role: string;
}

function getSecret(): string {
  const secret = process.env.TINA_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'TINA_AUTH_SECRET env var must be set (minimum 16 characters)'
    );
  }
  return secret;
}

function loadUsers(): User[] {
  return users as User[];
}

export function KoyaBackendAuthProvider(): BackendAuthProvider {
  return {
    async isAuthorized(req) {
      const authHeader =
        (req.headers as Record<string, string | undefined>)['authorization'] ||
        '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';

      if (!token) {
        return {
          isAuthorized: false,
          errorMessage: 'Missing authorization token',
          errorCode: 401,
        };
      }

      try {
        jwt.verify(token, getSecret());
        return { isAuthorized: true };
      } catch {
        return {
          isAuthorized: false,
          errorMessage: 'Invalid or expired token',
          errorCode: 401,
        };
      }
    },

    extraRoutes: {
      auth: {
        secure: false,
        handler: async (req, res) => {
          // Dispatch sub-routes: /api/tina/auth/login, /api/tina/auth/callback
          const url = new URL(
            req.url || '/',
            `http://${req.headers?.host || 'localhost'}`
          );
          const subPath = url.pathname.replace(/.*\/auth\/?/, '');

          if (subPath === 'callback' || subPath === '') {
            res.statusCode = 200;
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (subPath !== 'login') {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          const body = (req as unknown as { body?: unknown }).body;
          const { username, password } = (body as {
            username?: string;
            password?: string;
          }) || {};

          if (!username || !password) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({ error: 'Username and password are required' })
            );
            return;
          }

          const users = loadUsers();
          const user = users.find(
            (u) => u.username.toLowerCase() === username.toLowerCase()
          );

          if (!user) {
            // Constant-time comparison to prevent timing attacks
            await bcrypt.compare(
              password,
              '$2a$10$invalidhashpadding000000000000000000000000000'
            );
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Invalid credentials' }));
            return;
          }

          const token = jwt.sign(
            { sub: user.username, role: user.role },
            getSecret(),
            { expiresIn: '24h' }
          );

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              token,
              user: { username: user.username, role: user.role },
            })
          );
        },
      },
    },
  };
}
