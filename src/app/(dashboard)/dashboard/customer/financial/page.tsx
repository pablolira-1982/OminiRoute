"use client";

import { useEffect, useState } from "react";

type Summary = {
  totalRevenue: number;
  monthlyRecurringRevenue: number;
  paidCustomers: number;
  pendingPayments: number;
  overdueCustomers: number;
  suspendedCustomers: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
};

export default function CustomerFinancialPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<any[]>([]);

  async function load() {
    const [sRes, pRes] = await Promise.all([
      fetch("/api/customer/financial/summary"),
      fetch("/api/customer/financial/payments"),
    ]);
    const sJson = await sRes.json();
    const pJson = await pRes.json();
    setSummary(sJson || null);
    setPayments(pJson.payments || []);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Financial</h1>

      {summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <Card title="Total Revenue" value={`R$ ${summary.totalRevenue.toFixed(2)}`} />
          <Card title="Monthly Recurring Revenue" value={`R$ ${summary.monthlyRecurringRevenue.toFixed(2)}`} />
          <Card title="Paid Customers" value={`${summary.paidCustomers}`} />
          <Card title="Pending Payments" value={`${summary.pendingPayments}`} />
          <Card title="Overdue Customers" value={`${summary.overdueCustomers}`} />
          <Card title="Suspended Customers" value={`${summary.suspendedCustomers}`} />
          <Card title="Revenue This Month" value={`R$ ${summary.revenueThisMonth.toFixed(2)}`} />
          <Card title="Revenue Last Month" value={`R$ ${summary.revenueLastMonth.toFixed(2)}`} />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-sidebar/40 text-left">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Amount BRL</th>
              <th className="px-3 py-2">Payment Status</th>
              <th className="px-3 py-2">Payment Method</th>
              <th className="px-3 py-2">Payment Date</th>
              <th className="px-3 py-2">Renewal Date</th>
              <th className="px-3 py-2">Invoice ID</th>
              <th className="px-3 py-2">Transaction Reference</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">{p.customer?.name || p.customer?.email || "-"}</td>
                <td className="px-3 py-2">{p.subscription?.plan?.name || "-"}</td>
                <td className="px-3 py-2">R$ {Number(p.amount_brl || 0).toFixed(2)}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{p.payment_method || "-"}</td>
                <td className="px-3 py-2">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">{p.due_at ? new Date(p.due_at).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-2">{p.invoice_id || "-"}</td>
                <td className="px-3 py-2">{p.transaction_reference || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-text-muted">{title}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
