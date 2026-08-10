import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

export default function ChatInbox() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chat/threads")
      .then((r) => r.json())
      .then((data) => {
        setThreads(data);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={22} className="text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">محادثات الدعم</h1>
      </div>
      <p className="text-gray-500 mb-6">محادثة مستمرة مع كل عميل ومورد — بدون نظام تذاكر</p>

      <Card className="divide-y divide-gray-100">
        {loading && <div className="p-6 text-center text-gray-400 text-sm">جاري التحميل...</div>}
        {!loading && threads.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">لا توجد محادثات بعد.</div>
        )}
        {!loading &&
          threads.map((t) => (
            <Link
              key={`${t.partyType}-${t.partyId}`}
              href={`/chat/${t.partyType.toLowerCase()}/${t.partyId}`}
              className="p-4 flex justify-between items-center hover:bg-gray-50"
            >
              <div>
                <div className="font-medium text-gray-900">
                  {t.partyName}{" "}
                  <span className="text-xs text-gray-400">{t.partyType === "CLIENT" ? "(عميل)" : "(مورد)"}</span>
                </div>
                <div className="text-sm text-gray-400 truncate max-w-md">{t.lastMessage.body}</div>
              </div>
              <div className="flex items-center gap-3">
                {t.unreadCount > 0 && <Badge variant="info">{t.unreadCount} جديد</Badge>}
                <span className="text-xs text-gray-400">
                  {new Date(t.lastMessage.createdAt).toLocaleString("ar-SA-u-nu-latn")}
                </span>
              </div>
            </Link>
          ))}
      </Card>
    </div>
  );
}
