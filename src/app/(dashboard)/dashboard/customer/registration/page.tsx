"use client";

import { useEffect, useState } from "react";

type Plan = { id: string; name: string };

type Customer = {
  id: string;
  name: string;
  email: string;
  status: string;
  customer_subscriptions?: Array<{
    id: string;
    status: string;
    renews_at: string;
    token_limit: number;
    price_brl: number;
    plan?: { name?: string | null } | null;
    customer_tokens?: Array<{ token_prefix: string; status: string }>;
  }>;
};

export default function CustomerRegistrationPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", planId: "" });

  async function load() {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([fetch("/api/customer/customers"), fetch("/api/customer/plans")]);
    const cJson = await cRes.json();
    const pJson = await pRes.json();
    setCustomers(cJson.customers || []);
    setPlans(pJson.plans || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/customer/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to create customer");
      return;
    }

    const tokenRes = await fetch("/api/customer/token/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId: json.customerId, subscriptionId: json.subscriptionId }),
    });
    const tokenJson = await tokenRes.json();
    if (tokenRes.ok && tokenJson?.token) {
      alert(`Customer token (show once): ${tokenJson.token}`);
    }

    setForm({ name: "", email: "", password: "", planId: "" });
    await load();
  }

  async function suspendCustomer(id: string) {
    await fetch(`/api/customer/customers/${id}/suspend`, { method: "POST" });
    await load();
  }

  async function reactivateCustomer(id: string) {
    await fetch(`/api/customer/customers/${id}/reactivate`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Registration</h1>

      <form onSubmit={createCustomer} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-5">
        <input className="rounded border border-border px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2" placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <select className="rounded border border-border px-3 py-2" value={form.planId} onChange={(e) => setForm((v) => ({ ...v, planId: e.target.value }))} required>
          <option value="">Select plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
        <button className="rounded bg-primary px-4 py-2 text-white" type="submit">Create</button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-sidebar/40 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">E-mail</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Token Prefix</th>
                <th className="px-3 py-2">Usage</th>
                <th className="px-3 py-2">BRL Value</th>
                <th className="px-3 py-2">Renewal</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const sub = c.customer_subscriptions?.[0];
                const tok = sub?.customer_tokens?.[0];
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2">{c.email}</td>
                    <td className="px-3 py-2">{sub?.plan?.name || "-"}</td>
                    <td className="px-3 py-2">{tok?.token_prefix || "-"}</td>
                    <td className="px-3 py-2">0 / {(sub?.token_limit || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">R$ {Number(sub?.price_brl || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{sub?.renews_at ? new Date(sub.renews_at).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{c.status}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button className="rounded border border-border px-2 py-1" onClick={() => suspendCustomer(c.id)}>Suspend</button>
                      <button className="rounded border border-border px-2 py-1" onClick={() => reactivateCustomer(c.id)}>Reactivate</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
