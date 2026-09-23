/**
 * Kör Netlify Functions 2.0 (netlify/functions/*.mts) i Vites dev-server, så att `npm run dev`
 * ger hela stacken — /api/tiles, /api/bad/status, /api/vader — utan netlify-cli.
 *
 * Bara dev. Funktionerna laddas via Vites SSR-laddare (så att TypeScript, delade moduler och HMR
 * fungerar), anropas med en vanlig Request och deras Response skrivs tillbaka. `.env` läses in
 * i process.env (LM_USER m.fl.) på samma sätt som Netlify gör i drift.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

interface FunctionModule {
  default: (req: Request, context: unknown) => Promise<Response> | Response;
  config?: { path?: string | string[] };
}

function loadDotEnv(root: string): void {
  const file = join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1]!;
    if (process.env[key] === undefined) process.env[key] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
}

/** Matchar "/a/:b/:c" mot en sökväg och returnerar parametrarna. */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/');
  const u = pathname.split('/');
  if (p.length !== u.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = u[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function devFunctions(opts: { root: string; apiPrefix: string }): Plugin {
  const dir = resolve(opts.root, 'netlify/functions');
  return {
    name: 'norrkoping-dev-functions',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      loadDotEnv(opts.root);
      process.env['CONTEXT'] ??= 'dev';
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.m?ts$/.test(f)) : [];

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith(opts.apiPrefix)) return next();
        try {
          for (const file of files) {
            const mod = (await server.ssrLoadModule(join(dir, file))) as FunctionModule;
            const patterns = ([] as string[]).concat(mod.config?.path ?? []);
            for (const pattern of patterns) {
              const params = matchPath(pattern, url.pathname);
              if (!params) continue;
              const headers = new Headers();
              for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
              const method = req.method ?? 'GET';
              // Netlify ger handlern en hel Request; här måste kroppen läsas ur strömmen först
              // (POST används av höjdprofilen, IK-08).
              const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
              const request = new Request(`http://localhost:5173${req.url}`, { method, headers, ...(body === undefined ? {} : { body }) });
              const response = await mod.default(request, { params, ip: '127.0.0.1', site: { url: 'http://localhost:5173' } });
              res.statusCode = response.status;
              response.headers.forEach((v, k) => res.setHeader(k, v));
              res.end(Buffer.from(await response.arrayBuffer()));
              return;
            }
          }
          next();
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'DEV_FUNCTION_ERROR', message: (err as Error).message } }));
        }
      });
    },
  };
}
