"use client";
import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { Card, Empty, ErrorBox, Loading } from "@/components/ui";
import { Charts, RangeSelect } from "@/components/dashboard/Charts";

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data: s, error, loading } = useApi<any>(`/api/admin/stats?days=${days}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-semibold">Analytics</h1><RangeSelect days={days} onChange={setDays} /></div>
      <ErrorBox text={error} />
      {loading && !s ? <Loading /> : s?.empty ? <Card><Empty text="No projects yet." /></Card> : s && <Charts s={s} />}
    </div>
  );
}
