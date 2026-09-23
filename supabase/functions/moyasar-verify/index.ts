// moyasar-verify — التحقق من الدفع الإلكتروني في السيرفر (المرحلة 2).
// المبدأ: لا نصدّق المتصفح ولا حتى جسم الـwebhook؛ نجلب عملية الدفع من Moyasar بالمفتاح السري ونقارن
// المبلغ والعملة ورقم الطلب قبل تعليم الطلب «مدفوع». يعمل بمسارين:
//   1) من صفحة الطلب بعد العودة من نموذج الدفع: { order_no, access_token, payment_id }
//   2) webhook من Moyasar (secret_token في جسم الطلب): { secret_token, type, data: { id, ... } }
// الأسرار (في Supabase، لا في المستودع): MOYASAR_SECRET_KEY، MOYASAR_WEBHOOK_SECRET (اختياري لكنه مطلوب لتفعيل المسار 2).
// بدون MOYASAR_SECRET_KEY يرد بـ 503 «الدفع الإلكتروني غير مفعّل».
// يُنشر بـ verify_jwt = false لأن Moyasar لا ترسل ترويسات Supabase، والتحقق هنا برمز الوصول/سر الـwebhook.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MOYASAR_SECRET_KEY = Deno.env.get("MOYASAR_SECRET_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("MOYASAR_WEBHOOK_SECRET") ?? "";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Payment = { id: string; status: string; amount: number; currency: string; metadata?: Record<string, string> | null; source?: { type?: string } };

async function fetchPayment(id: string): Promise<Payment> {
  const r = await fetch(`https://api.moyasar.com/v1/payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: "Basic " + btoa(MOYASAR_SECRET_KEY + ":") },
  });
  if (r.status === 404) throw new Error("payment_not_found");
  if (!r.ok) throw new Error("moyasar_" + r.status);
  return await r.json();
}

async function logEvent(orderId: string, details: string) {
  await supabase.from("order_events").insert({ order_id: orderId, event: "payment", details, actor_name: "بوابة الدفع" });
}

// يطبّق نتيجة الدفع على الطلب ويعيد الحالة النهائية
async function applyPayment(order: { id: string; total: number; payment_status: string; gateway_payment_id: string | null }, p: Payment) {
  const expected = Math.round(Number(order.total) * 100);
  if (p.status === "paid" || p.status === "captured") {
    if (p.amount !== expected || p.currency !== "SAR") {
      await logEvent(order.id, `mismatch ${p.id}: ${p.amount} ${p.currency} ≠ ${expected} SAR`);
      return "mismatch";
    }
    if (order.payment_status === "paid") return "paid";
    const { error } = await supabase.from("orders")
      .update({ payment_status: "paid", gateway_payment_id: p.id })
      .eq("id", order.id).neq("payment_status", "paid");
    if (error) throw error;
    return "paid";
  }
  if (p.status === "failed") {
    if (order.payment_status !== "paid") {
      await supabase.from("orders").update({ payment_status: "failed", gateway_payment_id: p.id }).eq("id", order.id);
    }
    return "failed";
  }
  return "pending"; // initiated / authorized …
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!MOYASAR_SECRET_KEY) return json({ error: "الدفع الإلكتروني غير مفعّل" }, 503);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  try {
    // ---- المسار 2: webhook من Moyasar ----
    if (typeof body.secret_token === "string") {
      if (!WEBHOOK_SECRET || body.secret_token !== WEBHOOK_SECRET) return json({ error: "unauthorized" }, 401);
      const data = body.data as { id?: string } | undefined;
      if (!data?.id) return json({ error: "no payment id" }, 400);
      const p = await fetchPayment(data.id);
      const orderId = p.metadata?.order_id;
      if (!orderId) return json({ ok: true, result: "ignored" });
      const { data: order } = await supabase.from("orders").select("id,total,payment_status,gateway_payment_id")
        .eq("id", orderId).eq("payment_method", "gateway").maybeSingle();
      if (!order) return json({ ok: true, result: "ignored" });
      return json({ ok: true, result: await applyPayment(order, p) });
    }

    // ---- المسار 1: من صفحة الطلب ----
    const orderNo = String(body.order_no ?? "").toUpperCase().trim();
    const token = String(body.access_token ?? "").trim();
    const paymentId = String(body.payment_id ?? "").trim();
    if (!/^BR-\d+$/.test(orderNo) || !/^[0-9a-f]{32}$/.test(token) || !/^[0-9a-f-]{36}$/.test(paymentId)) {
      return json({ error: "bad request" }, 400);
    }
    const { data: order } = await supabase.from("orders").select("id,total,payment_status,gateway_payment_id")
      .eq("order_no", orderNo).eq("access_token", token).eq("payment_method", "gateway").maybeSingle();
    if (!order) return json({ error: "الطلب غير موجود" }, 404);

    const p = await fetchPayment(paymentId);
    if (p.metadata?.order_id !== order.id) {
      await logEvent(order.id, `wrong order ${p.id}`);
      return json({ error: "عملية الدفع لا تخص هذا الطلب" }, 400);
    }
    const result = await applyPayment(order, p);
    return json({ ok: true, result, payment_status: result === "paid" ? "paid" : result === "failed" ? "failed" : order.payment_status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "payment_not_found") return json({ error: "عملية الدفع غير موجودة" }, 404);
    console.error(msg);
    return json({ error: "تعذّر التحقق من الدفع الآن" }, 502);
  }
});
