import { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { encryptApiKey, decryptApiKey } from './crypto';
import { storage, StoredUserCredential, PaymentTransaction } from './storage';
import { verifyGoogleIdToken, exchangeGoogleAuthCode, createDevUser, createSessionToken, verifySessionToken, createGoogleOAuthState, verifyGoogleOAuthState } from './googleAuth';
import { executeAiMasteringSuggestion } from './aiProxy';

const getPublicOrigin = (req: IncomingMessage): string => {
  const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  const protocol = protoHeader || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${host}`;
};

const getBoldPricing = () => ({
  payg: { unitAmount: Number(process.env.BOLD_PRICE_PAYG || 4000), description: 'AuraMaster - 1 master completo' },
  pro_monthly: { unitAmount: Number(process.env.BOLD_PRICE_PRO_MONTHLY || 42000), description: 'AuraMaster Pro Ilimitado - Mensual' },
  pro_annual: { unitAmount: Number(process.env.BOLD_PRICE_PRO_ANNUAL || 420000), description: 'AuraMaster Pro Ilimitado - Anual' }
});

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

  let rawBodyPromise: Promise<Buffer> | null = null;
  const getRawBody = async (): Promise<Buffer> => {
    if (rawBodyPromise) return rawBodyPromise;
    rawBodyPromise = new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      req.on('data', chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > 1e6) {
          req.destroy();
          reject(new Error('Request payload too large'));
          return;
        }
        chunks.push(buffer);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
    return rawBodyPromise;
  };

  const getBody = async (): Promise<any> => {
    const raw = await getRawBody();
    return raw.length ? JSON.parse(raw.toString('utf8')) : {};
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
      const errorParam = query.get('error');
      const state = query.get('state') || '';

      if (errorParam) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`
          <!DOCTYPE html>
          <html>
            <head><title>Error de Autenticación</title></head>
            <body style="background:#030712;color:#f87171;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;">
              <h2>Acceso cancelado</h2>
              <p>${errorParam}</p>
              <button onclick="window.close()" style="margin-top:15px;padding:8px 16px;background:#1e293b;color:#fff;border:1px solid #334155;border-radius:8px;cursor:pointer;">Cerrar Ventana</button>
            </body>
          </html>
        `);
        return true;
      }

      const origin = getPublicOrigin(req);
      const redirectUri = `${origin}/auth/google/callback`;

      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      if (code && verifyGoogleOAuthState(state, redirectUri)) {
        const user = await exchangeGoogleAuthCode(code, redirectUri, { ip, userAgent });
        if (user) {
          const sessionToken = createSessionToken(user);
          const safeUserJson = JSON.stringify(user).replace(/</g, '\\u003c');
          const safeTokenJson = JSON.stringify(sessionToken);
          const safeOriginJson = JSON.stringify(origin);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Autenticado con Google</title></head>
              <body style="background:#030712;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
                <div style="text-align:center;">
                  <div style="font-size:28px;margin-bottom:12px;">✨</div>
                  <h3 style="margin:0 0 8px 0;font-weight:700;">¡Autenticación Exitosa!</h3>
                  <p style="margin:0;color:#94a3b8;font-size:14px;">Ingresando a AuraMaster DAW...</p>
                </div>
                <script>
                  try {
                    localStorage.setItem('auramaster_session_token', ${safeTokenJson});
                    localStorage.setItem('auramaster_user_profile', JSON.stringify(${safeUserJson}));
                    if (window.opener) {
                      try {
                        window.opener.postMessage({ type: 'AURAMASTER_AUTH_SUCCESS', user: ${safeUserJson}, sessionToken: ${safeTokenJson} }, ${safeOriginJson});
                      } catch (e) {}
                    }
                  } catch (e) {
                    console.error(e);
                  }
                  setTimeout(function() {
                    window.close();
                  }, 600);
                </script>
              </body>
            </html>
          `);
          return true;
        }
      }

      // If exchange failed, provide clear diagnostic message instead of infinite reload
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Error de Autenticación</title></head>
          <body style="background:#030712;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
            <h3 style="color:#f87171;margin:0 0 10px 0;">Error al verificar credenciales con Google</h3>
            <p style="color:#94a3b8;font-size:13px;max-width:440px;line-height:1.5;margin:0 0 15px 0;">
              El servidor no pudo intercambiar el código OAuth. Revisa que <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code> estén definidos en tu archivo <code>.env</code> y que la URI <code>${redirectUri}</code> esté autorizada en Google Cloud Console.
            </p>
            <button onclick="window.close()" style="padding:8px 20px;background:#1e293b;color:#fff;border:1px solid #334155;border-radius:10px;font-weight:bold;cursor:pointer;">Cerrar Ventana</button>
          </body>
        </html>
      `);
      return true;
    }

    // 0.05 Server-generated OAuth URL with signed state and proxy-safe redirect URI.
    if (pathname === '/api/auth/google/start' && req.method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) return sendJson(503, { error: 'Google OAuth no está configurado' });
      const redirectUri = `${getPublicOrigin(req)}/auth/google/callback`;
      const state = createGoogleOAuthState(redirectUri);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        prompt: 'select_account',
        state
      });
      return sendJson(200, { authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }

    // 0.1 Public Google OAuth Client ID endpoint
    if (pathname === '/api/auth/google-client-id' && req.method === 'GET') {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
      return sendJson(200, { clientId });
    }

    // 1. Google OAuth Login Endpoint (JSON API)
    if (pathname === '/api/auth/google' && req.method === 'POST') {
      const body = await getBody();
      let user = null;

      if (body.idToken) {
        user = await verifyGoogleIdToken(body.idToken);
      } else if (body.code) {
        user = await exchangeGoogleAuthCode(body.code, body.redirectUri || `http://${req.headers.host || 'localhost:3000'}/auth/google/callback`);
      } else if (body.isDevLogin && process.env.ALLOW_DEV_LOGIN === 'true') {
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
      return sendJson(200, { success: true, user: storage.getUser(session.userId) || session });
    }

    // Billing status and current commercial tiers.
    if (pathname === '/api/billing/status' && req.method === 'GET') {
      if (!session) return sendJson(401, { error: 'No autenticado' });
      const user = storage.getUser(session.userId);
      return sendJson(200, {
        user,
        tiers: {
          free: { priceUsd: 0, generations: 1 },
          payg: { priceUsd: 1, credits: 1 },
          pro_monthly: { priceUsd: 9.99, unlimited: true, apiKeyVault: true },
          pro_annual: { priceUsd: 99.99, unlimited: true, apiKeyVault: true }
        }
      });
    }

    // Create a Bold payment link. The secret credentials remain server-side.
    if (pathname === '/api/billing/bold/checkout' && req.method === 'POST') {
      if (!session) return sendJson(401, { error: 'Debes iniciar sesión con Google' });
      const body = await getBody();
      const plan = body.plan as 'payg' | 'pro_monthly' | 'pro_annual';
      const pricing = getBoldPricing();
      if (!pricing[plan]) return sendJson(400, { error: 'Plan no válido' });
      const quantity = plan === 'payg' ? Math.max(1, Math.min(100, Number.parseInt(body.quantity || '1', 10))) : 1;
      const expectedAmount = Number((pricing[plan].unitAmount * quantity).toFixed(2));
      const currency = (process.env.BOLD_CURRENCY || 'COP').toUpperCase();
      const apiKey = process.env.BOLD_API_KEY || '';
      if (!apiKey) return sendJson(503, { error: 'Bold aún no está configurado en el servidor' });

      const reference = `AM-${crypto.randomBytes(10).toString('hex')}-${Date.now().toString(36)}`;
      const user = storage.getUser(session.userId);
      const boldPayload = {
        amount_type: 'CLOSE',
        amount: { currency, total_amount: expectedAmount, tip_amount: 0 },
        reference,
        description: quantity > 1 ? `${pricing[plan].description} x${quantity}` : pricing[plan].description,
        callback_url: process.env.BOLD_REDIRECT_URL || `${getPublicOrigin(req)}/?payment=completed`,
        payer_email: user?.email || session.email
      };
      const boldRes = await fetch('https://integrations.api.bold.co/online/link/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `x-api-key ${apiKey}` },
        body: JSON.stringify(boldPayload)
      });
      const boldData: any = await boldRes.json().catch(() => ({}));
      const checkoutUrl = boldData?.payload?.url;
      const paymentLink = boldData?.payload?.payment_link;
      if (!boldRes.ok || !checkoutUrl || !paymentLink) {
        console.error('[Bold] Checkout creation failed', boldRes.status, boldData?.errors || 'Unknown response');
        return sendJson(502, { error: 'Bold no pudo crear el enlace de pago. Intenta nuevamente.' });
      }
      const now = Date.now();
      const transaction: PaymentTransaction = {
        reference, userId: session.userId, plan, quantity, expectedAmount, currency,
        status: 'PENDING', paymentLink, checkoutUrl, notificationIds: [], createdAt: now, updatedAt: now
      };
      storage.createPaymentTransaction(transaction);
      return sendJson(200, { checkoutUrl, reference });
    }

    // Signed Bold webhook. Bold signs Base64(raw body) with HMAC-SHA256.
    if (pathname === '/api/webhooks/bold' && req.method === 'POST') {
      const secret = process.env.BOLD_SECRET_KEY || '';
      if (!secret) return sendJson(503, { error: 'Webhook Bold no configurado' });
      const raw = await getRawBody();
      const receivedSignature = String(req.headers['x-bold-signature'] || '').trim().toLowerCase();
      const calculated = crypto.createHmac('sha256', secret).update(raw.toString('base64')).digest('hex');
      const received = Buffer.from(receivedSignature, 'hex');
      const expected = Buffer.from(calculated, 'hex');
      if (!receivedSignature || received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
        return sendJson(400, { error: 'Firma Bold inválida' });
      }
      const event = raw.length ? JSON.parse(raw.toString('utf8')) : {};
      const data = event.data || {};
      const referenceOrLink = data?.metadata?.reference || data.reference || data.payment_link || '';
      if (!event.id || !event.type || !referenceOrLink) return sendJson(400, { error: 'Evento Bold incompleto' });
      try {
        const result = storage.recordPaymentEvent(referenceOrLink, {
          notificationId: String(event.id),
          type: String(event.type),
          paymentId: data.payment_id ? String(data.payment_id) : undefined,
          amount: data.amount?.total === undefined ? undefined : Number(data.amount.total),
          currency: data.amount?.currency ? String(data.amount.currency) : undefined
        });
        return sendJson(200, { received: true, duplicate: result.duplicate });
      } catch (e: any) {
        console.error('[Bold] Rejected verified webhook:', e.message);
        return sendJson(400, { error: e.message || 'No se pudo asociar la transacción' });
      }
    }

    if (pathname === '/api/usage/consume' && req.method === 'POST') {
      if (!session) return sendJson(401, { error: 'No autenticado' });
      const body = await getBody();
      const count = Number(body.count || 1);
      const operationId = String(body.operationId || '');
      if (!operationId) return sendJson(400, { error: 'Falta operationId' });
      const user = storage.consumeGenerations(session.userId, count, operationId);
      return sendJson(200, { success: true, user });
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
      if (!storage.isProUser(session.userId)) {
        return sendJson(403, { code: 'PRO_REQUIRED', error: 'El baúl de API Keys está disponible únicamente en Pro Ilimitado.' });
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
      if (!storage.isProUser(session.userId)) {
        return sendJson(403, { code: 'PRO_REQUIRED', error: 'Necesitas Pro Ilimitado para añadir una API Key.' });
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
      if (!storage.isProUser(session.userId)) {
        return sendJson(403, { code: 'PRO_REQUIRED', error: 'Necesitas Pro Ilimitado para gestionar el baúl de API Keys.' });
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
      if (!storage.isProUser(session.userId)) {
        return sendJson(403, { code: 'PRO_REQUIRED', error: 'Necesitas Pro Ilimitado para usar una API Key propia.' });
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
      if (!storage.isProUser(session.userId)) {
        return sendJson(403, { code: 'PRO_REQUIRED', error: 'El Asistente con API Key propia está disponible únicamente en Pro Ilimitado.' });
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
      const admin = session ? storage.getUser(session.userId) : null;
      if (!admin || admin.role !== 'admin') return sendJson(403, { error: 'Acceso de administrador requerido' });
      const users = storage.getAllUsers();
      return sendJson(200, {
        success: true,
        totalRegistered: users.length,
        users
      });
    }

    // 10. Admin Export All Users as CSV
    if (pathname === '/api/admin/emails.csv' && req.method === 'GET') {
      const admin = session ? storage.getUser(session.userId) : null;
      if (!admin || admin.role !== 'admin') return sendJson(403, { error: 'Acceso de administrador requerido' });
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
