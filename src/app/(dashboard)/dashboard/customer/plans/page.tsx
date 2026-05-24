"use client";

import { useEffect, useState } from "react";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  native_combo_id: string;
  monthly_token_limit: number;
  price_brl: number;
  billing_interval: string;
  status: string;
};

export default function CustomerPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    nativeComboId: "",
    monthlyTokenLimit: "1000000",
    priceBrl: "99",
    billingInterval: "monthly",
    status: "active",
  });

  async function load() {
    const res = await fetch("/api/customer/plans");
    const json = await res.json();
    setPlans(json.plans || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/customer/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        monthlyTokenLimit: Number(form.monthlyTokenLimit),
        priceBrl: Number(form.priceBrl),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Failed to create plan");
      return;
    }
    setForm({
      name: "",
      description: "",
      nativeComboId: "",
      monthlyTokenLimit: "1000000",
      priceBrl: "99",
      billingInterval: "monthly",
      status: "active",
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Plans</h1>

      <form onSubmit={createPlan} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-4">
        <input className="rounded border border-border px-3 py-2" placeholder="Plan Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2" placeholder="Native Combo ID" value={form.nativeComboId} onChange={(e) => setForm((v) => ({ ...v, nativeComboId: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2" placeholder="Monthly Token Limit" value={form.monthlyTokenLimit} onChange={(e) => setForm((v) => ({ ...v, monthlyTokenLimit: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2" placeholder="Price BRL" value={form.priceBrl} onChange={(e) => setForm((v) => ({ ...v, priceBrl: e.target.value }))} required />
        <input className="rounded border border-border px-3 py-2 md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
        <select className="rounded border border-border px-3 py-2" value={form.billingInterval} onChange={(e) => setForm((v) => ({ ...v, billingInterval: e.target.value }))}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button className="rounded bg-primary px-4 py-2 text-white" type="submit">Create Plan</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-sidebar/40 text-left">
            <tr>
              <th className="px-3 py-2">Plan Name</th>
              <th className="px-3 py-2">Native Combo</th>
              <th className="px-3 py-2">Monthly Token Limit</th>
              <th className="px-3 py-2">Price BRL</th>
              <th className="px-3 py-2">Billing Interval</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t border-border">
                <td className="px-3 py-2">{plan.name}</td>
                <td className="px-3 py-2">{plan.native_combo_id}</td>
                <td className="px-3 py-2">{Number(plan.monthly_token_limit).toLocaleString()}</td>
                <td className="px-3 py-2">R$ {Number(plan.price_brl).toFixed(2)}</td>
                <td className="px-3 py-2">{plan.billing_interval}</td>
                <td className="px-3 py-2">{plan.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
