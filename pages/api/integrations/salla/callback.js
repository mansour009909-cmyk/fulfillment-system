import { exchangeCodeForToken, saveClientToken, fetchMerchantId, subscribeOrderWebhook } from "../../../../lib/salla";

function baseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.includes("localhost") ? "http" : "https");
  return `${proto}://${req.headers.host}`;
}

// صفحة الاستدعاء اللي سلة يرجّع لها المستخدم بعد موافقته — تبادل الكود بتوكن وحفظه لهذا العميل،
// ثم جلب معرّف متجره (لمطابقة إشعارات الويبهوك لاحقًا) وتسجيل اشتراك الطلبات الجديدة تلقائيًا.
// خطوتا المتجر/الويبهوك best-effort — فشلهما لا يلغي نجاح الربط الأساسي (التوكن محفوظ بأي حال).
export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(302, `/integrations?sallaError=${encodeURIComponent(String(error))}`);
  }

  const clientId = Number(state);
  if (!code || !clientId) {
    return res.redirect(302, "/integrations?sallaError=missing_code_or_state");
  }

  try {
    const origin = baseUrl(req);
    const tokenData = await exchangeCodeForToken(code, `${origin}/api/integrations/salla/callback`);
    const merchantId = await fetchMerchantId(tokenData.access_token);
    await saveClientToken(clientId, tokenData, merchantId);
    await subscribeOrderWebhook(tokenData.access_token, `${origin}/api/integrations/salla/webhook`);
    return res.redirect(302, "/integrations?sallaConnected=1");
  } catch (err) {
    return res.redirect(302, `/integrations?sallaError=${encodeURIComponent(err.message)}`);
  }
}
