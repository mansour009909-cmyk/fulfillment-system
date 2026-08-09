// تكامل سلة (Salla Partner App — OAuth2 Authorization Code) — بُني حسب توثيق سلة العام
// لتطبيقات الشركاء (accounts.salla.sa)؛ يحتاج تأكيد/تعديل فعلي بعد اعتماد التطبيق من سلة
// واختبار الاستجابة الحقيقية — هذا متوقّع (نفس نهج تكامل دفترة).
//
// الفكرة: تطبيق واحد مسجَّل عندنا بمنصّة شركاء سلة (SALLA_APP، نظامي). لكل عميل نولّد رابط
// تفويض خاص فيه (state = معرّف العميل عندنا)، العميل يوافق بمتجره على سلة، وسلة يرجّعنا
// لصفحة الاستدعاء بكود نبادله بـ access/refresh token خاصين بمتجره فقط.
import { prisma } from "./prisma";
import { getIntegration } from "./integrations";

const AUTHORIZE_URL = "https://accounts.salla.sa/oauth2/auth";
const TOKEN_URL = "https://accounts.salla.sa/oauth2/token";

export async function getSallaApp() {
  return getIntegration("SALLA_APP");
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
    state: String(clientId),
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
export async function saveClientToken(clientId, tokenData) {
  const data = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
  };

  const existing = await prisma.integration.findFirst({ where: { provider: "SALLA", clientId } });
  if (existing) {
    return prisma.integration.update({ where: { id: existing.id }, data });
  }
  return prisma.integration.create({ data: { provider: "SALLA", clientId, ...data } });
}
