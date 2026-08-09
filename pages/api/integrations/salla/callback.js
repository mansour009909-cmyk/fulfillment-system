import { exchangeCodeForToken, saveClientToken } from "../../../../lib/salla";

function callbackUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host?.includes("localhost") ? "http" : "https");
  return `${proto}://${req.headers.host}/api/integrations/salla/callback`;
}

// صفحة الاستدعاء اللي سلة يرجّع لها المستخدم بعد موافقته — تبادل الكود بتوكن وحفظه لهذا العميل
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
    const tokenData = await exchangeCodeForToken(code, callbackUrl(req));
    await saveClientToken(clientId, tokenData);
    return res.redirect(302, "/integrations?sallaConnected=1");
  } catch (err) {
    return res.redirect(302, `/integrations?sallaError=${encodeURIComponent(err.message)}`);
  }
}
