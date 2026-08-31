import { IncomingMessage, ServerResponse } from 'http';
import { encryptApiKey, decryptApiKey } from './crypto';
import { storage, StoredUserCredential } from './storage';
import { verifyGoogleIdToken, exchangeGoogleAuthCode, createDevUser, createSessionToken, verifySessionToken } from './googleAuth';
import { executeAiMasteringSuggestion } from './aiProxy';

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/') && !url.startsWith('/auth/google/callback')) {
    return false;
  }

  // JSON helper
  const sendJson = (status: number, data: any): boolean => {
    if (!res.writableEnded) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(data));
    }
    return true;
  };

  // Body parser helper
  const getBody = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) {
          req.destroy();
          reject(new Error('Request payload too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  };

  // Extract auth session
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const session = verifySessionToken(token);

  const pathname = url.split('?')[0];
  const query = new URL(url, 'http://localhost:3000').searchParams;

  try {
    // 0. Direct OAuth 2.0 Callback Route (Browser Redirect Flow)
    if (pathname === '/auth/google/callback') {
      const code = query.get('code');
      const origin = req.headers.origin || `http://${req.headers.host || 'localhost:3000'}`;
      const redirectUri = `${origin}/auth/google/callback`;

      if (code) {
        const user = await exchangeGoogleAuthCode(code, redirectUri);
        if (user) {
          const sessionToken = createSessionToken(user);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Autenticado con Google</title></head>
              <body style="background:#030712;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                <p>Conectando con Google OAuth...</p>
                <script>
                  localStorage.setItem('auramaster_session_token', '${sessionToken}');
                  localStorage.setItem('auramaster_user_profile', '${JSON.stringify(user).replace(/'/g, "\\'")}');
                  window.opener ? window.opener.location.reload() : (window.location.href = '/');
                  window.close();
                </script>
              </body>
            </html>
          `);
          return true;
        }
      }

      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.end();
      return true;
    }

    // 1. Google OAuth Login Endpoint (JSON API)
    if (pathname === '/api/auth/google' && req.method === 'POST') {
      const body = await getBody();
      let user = null;

      if (body.idToken) {
        user = await verifyGoogleIdToken(body.idToken);
      } else if (body.code) {
        user = await exchangeGoogleAuthCode(body.code, body.redirectUri || `http://${req.headers.host || 'localhost:3000'}/auth/google/callback`);
      } else if (body.isDevLogin) {
        user = createDevUser(body.email || 'studio.engineer@auramaster.ai', body.name || 'Google Audio Engineer');
      }

      if (!user) {
        return sendJson(401, { error: 'Token de autenticación de Google inválido o expirado' });
      }

      const sessionToken = createSessionToken(user);
      return sendJson(200, {
        success: true,
        user,
        sessionToken
      });
    }

    // 2. Get Current User Profile
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      if (!session) {
        return sendJson(401, { error: 'No autenticado' });
      }
      return sendJson(200, { success: true, user: session });
    }

    // 3. Logout
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return sendJson(200, { success: true });
    }

    // 4. Get User AI Config (Masked - never returns plain key!)
    if (pathname === '/api/ai/config' && req.method === 'GET') {
      if (!session) {
        return sendJson(401, { error: 'Debes iniciar sesión con Google para acceder al baúl de IA' });
      }

      const cred = storage.getCredential(session.userId);
      if (!cred) {
        return sendJson(200, {
          configured: false,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          maskedKey: null
        });
      }

      return sendJson(200, {
        configured: true,
        provider: cred.provider,
        model: cred.model,
        baseUrl: cred.baseUrl,
        maskedKey: cred.maskedKey,
        updatedAt: cred.updatedAt
      });
    }

    // 5. Save & Encrypt User API Key (AES-256-GCM)
    if (pathname === '/api/ai/config' && req.method === 'POST') {
      if (!session) {
        return sendJson(401, { error: 'Debes iniciar sesión con Google' });
      }

      const body = await getBody();
      const { provider = 'gemini', model = 'gemini-2.5-flash', apiKey, baseUrl } = body;

      if (!apiKey || !apiKey.trim()) {
        return sendJson(400, { error: 'La API Key no puede estar vacía' });
      }

      // Encrypt with AES-256-GCM + User Isolation
      const { encryptedKey, iv, authTag, maskedKey } = encryptApiKey(apiKey, session.userId);

      const credential: StoredUserCredential = {
        userId: session.userId,
        email: session.email,
        provider,
        model,
        baseUrl,
        encryptedKey,
        iv,
        authTag,
        maskedKey,
        updatedAt: Date.now()
      };

      storage.saveCredential(credential);

      return sendJson(200, {
        success: true,
        message: '¡API Key cifrada con AES-256-GCM y resguardada exitosamente en el VPS!',
        config: {
          configured: true,
          provider,
          model,
          baseUrl,
          maskedKey,
          updatedAt: credential.updatedAt
        }
      });
    }

    // 6. Delete User API Key (Purge from Vault)
    if (pathname === '/api/ai/config' && req.method === 'DELETE') {
      if (!session) {
        return sendJson(401, { error: 'Debes iniciar sesión con Google' });
      }

      const deleted = storage.deleteCredential(session.userId);
      return sendJson(200, {
        success: true,
        message: deleted ? 'API Key eliminada del baúl seguro del VPS' : 'No había clave guardada'
      });
    }

    // 7. Test AI Connection Server-Side
    if (pathname === '/api/ai/test' && req.method === 'POST') {
      if (!session) {
        return sendJson(401, { error: 'Debes iniciar sesión con Google' });
      }

      try {
        const testResult = await executeAiMasteringSuggestion(
          session.userId,
          'Test connection: natural acoustic warm polish',
          {}
        );
        return sendJson(200, { success: true, message: '¡Conexión y cifrado verificados con éxito!', testResult });
      } catch (e: any) {
        return sendJson(400, { success: false, error: e.message || 'Error al conectar con la API' });
      }
    }

    // 8. Core Secure AI Mastering Suggestion Proxy
    if (pathname === '/api/ai/mastering-suggestion' && req.method === 'POST') {
      if (!session) {
        return sendJson(401, { error: 'Debes iniciar sesión con Google para usar el Asistente IA' });
      }

      const body = await getBody();
      const { prompt, currentParams } = body;

      if (!prompt || !prompt.trim()) {
        return sendJson(400, { error: 'El prompt no puede estar vacío' });
      }

      const suggestedParams = await executeAiMasteringSuggestion(session.userId, prompt, currentParams);
      return sendJson(200, { success: true, suggestedParams });
    }

    // 9. Admin Registered Users List & Email Audit
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const users = storage.getAllUsers();
      return sendJson(200, {
        success: true,
        totalRegistered: users.length,
        users
      });
    }

    // 10. Admin Export All Users as CSV
    if (pathname === '/api/admin/emails.csv' && req.method === 'GET') {
      const fs = await import('fs');
      const csvPath = storage.getCsvFilePath();
      if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="auramaster_users_emails.csv"');
        res.end(content);
        return true;
      } else {
        return sendJson(404, { error: 'No se encontró el registro de correos' });
      }
    }

    return sendJson(404, { error: 'Endpoint no encontrado' });
  } catch (error: any) {
    console.error('[API Router Error]', error);
    return sendJson(500, { error: error.message || 'Error interno del servidor' });
  }
}
