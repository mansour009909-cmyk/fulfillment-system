// عميل دفترة (Daftra API v2) — ينشئ فاتورة بدفترة مقابل ClientInvoice عندنا.
// بُني حسب أفضل معرفة عامة بواجهة دفترة العامة (APIKEY header، مسار /api2/invoices)؛
// يحتاج تأكيد/تعديل فعلي بعد ربط حساب حقيقي واختبار الاستجابة الفعلية — هذا متوقّع.

export function isDaftraConfigured(settings) {
  return Boolean(settings.daftraApiKey && settings.daftraSubdomain);
}

export async function createDaftraInvoice(settings, { clientInvoice, client }) {
  if (!isDaftraConfigured(settings)) {
    throw new Error("دفترة غير مربوطة بعد — أضف مفتاح API والنطاق الفرعي من الإعدادات");
  }
  if (!client.daftraClientId) {
    throw new Error(`العميل "${client.name}" ما له معرّف بدفترة بعد — عيّنه من صفحة العميل أولًا`);
  }

  const url = `https://${settings.daftraSubdomain}.daftra.com/api2/invoices`;
  const body = {
    Invoice: {
      client_id: client.daftraClientId,
      date: new Date().toISOString().slice(0, 10),
      currency_code: "SAR",
      InvoiceItem: [
        {
          item: `رسوم فولفيلمنت (${new Date(clientInvoice.periodStart).toLocaleDateString(
            "ar-SA-u-nu-latn"
          )} - ${new Date(clientInvoice.periodEnd).toLocaleDateString("ar-SA-u-nu-latn")})`,
          unit_price: clientInvoice.total,
          quantity: 1,
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", APIKEY: settings.daftraApiKey },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(`دفترة رفضت الطلب (${res.status}): ${data?.error_message || text.slice(0, 200)}`);
  }

  const daftraId = data?.data?.id || data?.id;
  if (!daftraId) {
    throw new Error("دفترة ما رجّعت رقم فاتورة — قد يحتاج تعديل شكل الطلب حسب نسخة حسابك الفعلية");
  }
  return { daftraInvoiceId: String(daftraId) };
}
