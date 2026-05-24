"use client";

import { useEffect, useMemo, useState } from "react";

export default function CustomerPortalPage() {
  const [jwt, setJwt] = useState("");
  const [me, setMe] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [nativeUsage, setNativeUsage] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const tokenStatus = useMemo(() => me?.customer_subscriptions?.[0]?.customer_tokens?.[0]?.status || "-", [me]);
  const tokenPrefix = useMemo(() => me?.customer_subscriptions?.[0]?.customer_tokens?.[0]?.token_prefix || "-", [me]);

  async function loadPortalData() {
    if (!jwt.trim()) return;
    const headers = { authorization: `Bearer ${jwt.trim()}` };
    const [meRes, usageRes, paymentsRes] = await Promise.all([
      fetch("/api/customer/portal/me", { headers }),
      fetch("/api/customer/portal/usage", { headers }),
      fetch("/api/customer/portal/payments", { headers }),
    ]);

    const meJson = await meRes.json();
    const usageJson = await usageRes.json();
    const paymentsJson = await paymentsRes.json();

    if (!meRes.ok) {
      alert(meJson?.error || "Unauthorized");
      return;
    }

    setMe(meJson.me);
    setUsage(usageJson.usage || []);
    setNativeUsage(usageJson.nativeUsage || []);
    setPayments(paymentsJson.payments || []);
  }

  async function renew() {
    const res = await fetch("/api/customer/portal/renew", {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt.trim()}`,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to renew");
      return;
    }
    await loadPortalData();
  }

  const sub = me?.customer_subscriptions?.[0];
  const usedTokensFromNative = nativeUsage.reduce((acc, row) => acc + Number(row.total_tokens || 0), 0);
  const usedTokensFromSaas = usage.reduce((acc, row) => acc + Number(row.total_tokens || 0), 0);
  const usedTokens = Math.max(usedTokensFromNative, usedTokensFromSaas);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Customer Portal</h1>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-sm text-text-muted">Paste your Supabase user JWT to access your portal data.</p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-border px-3 py-2"
            placeholder="Bearer JWT"
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
          />
          <button className="rounded bg-primary px-4 py-2 text-white" onClick={loadPortalData}>
            Load
          </button>
        </div>
      </div>

      {me && (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Current Plan" value={sub?.plan?.name || "-"} />
            <Card title="API Token" value={tokenPrefix} />
            <Card title="Token Status" value={tokenStatus} />
            <Card title="Used Tokens" value={usedTokens.toLocaleString()} />
            <Card title="Token Limit" value={Number(sub?.token_limit || 0).toLocaleString()} />
            <Card title="Renewal Date" value={sub?.renews_at ? new Date(sub.renews_at).toLocaleDateString() : "-"} />
          </div>

          <div className="flex gap-2">
            <button className="rounded border border-border px-3 py-2" onClick={() => navigator.clipboard.writeText(tokenPrefix)}>
              Copy Token Prefix
            </button>
            <button className="rounded bg-primary px-3 py-2 text-white" onClick={renew}>
              Renew
            </button>
          </div>

          <div className="rounded-xl border border-border p-4">
            <h2 className="mb-3 text-lg font-semibold">Usage History</h2>
            <p className="mb-2 text-xs text-text-muted">
              Native OmniRoute usage entries: {nativeUsage.length} | SaaS ledger entries: {usage.length}
            </p>
            <div className="max-h-64 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-sidebar/40 text-left">
                  <tr>
                    <th className="px-3 py-2">Endpoint</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Input</th>
                    <th className="px-3 py-2">Output</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">{row.endpoint || "-"}</td>
                      <td className="px-3 py-2">{row.model || "-"}</td>
                      <td className="px-3 py-2">{Number(row.input_tokens || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{Number(row.output_tokens || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{Number(row.total_tokens || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <h2 className="mb-3 text-lg font-semibold">Payments</h2>
            <div className="max-h-64 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-sidebar/40 text-left">
                  <tr>
                    <th className="px-3 py-2">Amount BRL</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-3 py-2">R$ {Number(row.amount_brl || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.payment_method || "-"}</td>
                      <td className="px-3 py-2">{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-text-muted">{title}</p>
      <p className="mt-2 text-lg font-semibold break-all">{value}</p>
    </div>
  );
}
