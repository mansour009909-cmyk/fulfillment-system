import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Card } from "../ui/Card";

// عرض محادثة + صندوق رد، مع تحديث دوري بسيط (polling) بدل بنية real-time كاملة —
// كافٍ لتجربة "شات" مستمر بدون تعقيد إضافي غير مطلوب حاليًا.
export function ChatThread({ apiUrl, ownRole, ownLabel, otherLabel }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  async function load() {
    const res = await fetch(apiUrl);
    const data = await res.json();
    setMessages(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setBody("");
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    await load();
    setSending(false);
  }

  return (
    <Card className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && <div className="text-center text-gray-400 text-sm">جاري التحميل...</div>}
        {!loading && messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">لا توجد رسائل بعد — ابدأ المحادثة.</div>
        )}
        {messages.map((m) => {
          const mine = m.senderRole === ownRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <div>{m.body}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-blue-100" : "text-gray-400"}`}>
                  {mine ? ownLabel : otherLabel} — {new Date(m.createdAt).toLocaleString("ar-SA-u-nu-latn")}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-gray-100 p-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب رسالتك..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Send size={14} />
          إرسال
        </button>
      </form>
    </Card>
  );
}
