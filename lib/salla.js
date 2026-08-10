// تكامل سلة (Salla Partner App — OAuth2 Authorization Code + Webhooks) — بُني حسب توثيق سلة
// العام لتطبيقات الشركاء (accounts.salla.sa / api.salla.dev)؛ يحتاج تأكيد/تعديل فعلي بعد
// اعتماد التطبيق من سلة واختبار الاستجابة الحقيقية — هذا متوقّع (نفس نهج تكامل دفترة).
//
// الفكرة: تطبيق واحد مسجَّل عندنا بمنصّة شركاء سلة (SALLA_APP، نظامي). لكل عميل نولّد رابط
// تفويض خاص فيه (state = معرّف العميل عندنا)، العميل يوافق بمتجره على سلة، وسلة يرجّعنا
// لصفحة الاستدعاء بكود نبادله بـ access/refresh token خاصين بمتجره فقط. بعد الربط نسجّل
// اشتراك ويبهوك (order.created) عند سلة، ونخزّن معرّف المتجر (merchant) لمطابقة الإشعارات
// الواردة لاحقًا بالعميل الصحيح عندنا.
import crypto from "crypto";
import { prisma } from "./prisma";
import { getIntegration } from "./integrations";

const AUTHORIZE_URL = "https://accounts.salla.sa/oauth2/auth";
const TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
const API_BASE = "https://api.salla.dev/admin/v2";
const STATE_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

export async function getSallaApp() {
  return getIntegration("SALLA_APP");
}

// state موقّع (HMAC) بدل رقم العميل الخام — سلة يرفض state بسيط/متوقَّع كـ"invalid_state"
// (لازم يبان عشوائي فعليًا لحماية CSRF حقيقية، مو مجرّد شكل). base64url بلا حشو ليطابق
// طابع القيم المسموحة عادة بمعاملات URL.
function signState(clientId) {
  const payload = `${clientId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function verifyState(state) {
  const parts = String(state || "").split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", STATE_SECRET).update(Buffer.from(payloadB64, "base64url")).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  } catch {
    return null;
  }
  const payload = Buffer.from(payloadB64, "base64url").toString();
  const [clientId] = payload.split(".");
  return Number(clientId) || null;
}

export async function buildAuthorizeUrl(clientId, redirectUri) {
  const app = await getSallaApp();
  if (!app?.apiKey) {
    throw new Error('لازم تضيف بيانات تطبيق سلة (Client ID/Secret) أولًا من صفحة "API"');
  }
  const params = new URLSearchParams({
    client_id: app.apiKey,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "offline_access",
    state: signState(clientId),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code, redirectUri) {
  const app = await getSallaApp();
  if (!app?.apiKey || !app?.apiSecret) {
    throw new Error("بيانات تطبيق سلة غير مكتملة");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: app.apiKey,
      client_secret: app.apiSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok || !data?.access_token) {
    throw new Error(`سلة رفضت طلب الربط: ${data?.error_description || text.slice(0, 200)}`);
  }
  return data; // { access_token, refresh_token, expires_in, ... }
}

// يحفظ نتيجة تفويض ناجح لعميل معيّن — يُستدعى من صفحة الاستدعاء (callback) بعد تبادل الكود
export async function saveClientToken(clientId, tokenData, merchantId) {
  const data = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
    ...(merchantId ? { accountId: String(merchantId) } : {}),
  };

  const existing = await prisma.integration.findFirst({ where: { provider: "SALLA", clientId } });
  if (existing) {
    return prisma.integration.update({ where: { id: existing.id }, data });
  }
  return prisma.integration.create({ data: { provider: "SALLA", clientId, ...data } });
}

// يجيب معرّف المتجر (merchant) خاص بالتوكن — نحتاجه لمطابقة إشعارات الويبهوك الواردة لاحقًا
// بالعميل الصحيح عندنا (الإشعار يحمل merchant، مو معرّفنا الداخلي). مؤكَّد من توثيق سلة الرسمي
// (accounts.salla.sa/oauth2/user/info، الاستجابة {..., merchant: {id, ...}}) — راجع
// github.com/SallaApp/oauth2-merchant.
export async function fetchMerchantId(accessToken) {
  try {
    const res = await fetch("https://accounts.salla.sa/oauth2/user/info", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.merchant?.id || null;
  } catch {
    return null;
  }
}

// يسجّل اشتراك ويبهوك (order.created) عند سلة ليرسل لنا الطلبات الجديدة لحظيًا بدل الاستعلام الدوري
export async function subscribeOrderWebhook(accessToken, webhookUrl) {
  try {
    const res = await fetch(`${API_BASE}/webhooks/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ name: "فولفيلمنت — طلبات جديدة", event: "order.created", url: webhookUrl, version: 2 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// تحقق توقيع الويبهوك (HMAC-SHA256 على الجسم الخام بسر الويبهوك) — يمنع قبول إشعارات مزوَّرة
export function verifyWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader || !webhookSecret) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// يدفع الكمية المتوفرة الجديدة لكتاب معيّن (بحسب باركوده = SKU بسلة) لمتجر عميل مربوط.
// اتجاه المزامنة: نظامنا → سلة، عشان ما يبيع المتجر كمية أكبر من المتوفر فعليًا بمخزوننا المشترك.
export async function pushStockUpdate(integration, barcode, quantity) {
  const res = await fetch(`${API_BASE}/products/quantities`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${integration.accessToken}` },
    body: JSON.stringify({ sku: barcode, quantity }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`تعذّر تحديث الكمية بسلة لباركود ${barcode}: ${text.slice(0, 200)}`);
  }
}
