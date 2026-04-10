import { TinaNodeBackend } from '@tinacms/datalayer';
import { KoyaBackendAuthProvider } from '../../../../tina/auth/backend';
import databaseClient from '../../../../tina/__generated__/databaseClient';

const backend = TinaNodeBackend({
  authProvider: KoyaBackendAuthProvider(),
  databaseClient,
});

/**
 * Adapt TinaCMS Node-style (req,res) handler to Next.js App Router
 * Web Request/Response API.
 */
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = req.method === 'POST' ? await req.json() : undefined;

  return new Promise<Response>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeReq: any = {
      url: url.pathname + url.search,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body,
    };

    let statusCode = 200;
    const chunks: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeRes: any = {
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
      setHeader() {},
      write(data: string) {
        chunks.push(data);
      },
      end(data?: string) {
        if (data) chunks.push(data);
        resolve(
          new Response(chunks.join(''), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      },
    };

    backend(nodeReq, nodeRes);
  });
}

export { handler as GET, handler as POST };
