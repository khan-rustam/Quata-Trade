"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import type { EnquiryStatus } from "@quatatrade/shared";
import { AdminTitle, Pagination } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { usePageClamp } from "@/hooks/use-page-clamp";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;
const STATUS_TONE: Record<EnquiryStatus, "accent" | "neutral" | "success" | "warning"> = {
  new: "accent",
  read: "neutral",
  replied: "success",
  archived: "warning",
};
const NEXT: EnquiryStatus[] = ["read", "replied", "archived"];

export default function AdminEnquiriesPage(): React.JSX.Element {
  const tx = useTranslations("adminEnquiries");
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "enquiries", page],
    queryFn: () => adminApi.adminEnquiries({ page, pageSize: PAGE_SIZE }),
  });

  usePageClamp(page, data?.items.length, setPage);
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: EnquiryStatus }) =>
      adminApi.adminUpdateEnquiryStatus(v.id, { status: v.status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "enquiries"] }),
    onError: (err) => toast.error(tx("error"), apiErrorMessage(err)),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <AdminTitle title={tx("pageTitle")} subtitle={tx("pageSubtitle")} />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <Card className="text-center text-sm text-text-3">{tx("empty")}</Card>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <Card key={e.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{e.name}</span>
                  <span className="ml-2 break-all text-sm text-text-3">{e.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[e.status]}>{tx(`status_${e.status}`)}</Badge>
                  <span className="text-xs text-text-3">{formatDateTime(e.createdAt)}</span>
                </div>
              </div>
              {e.subject && <p className="text-sm font-medium">{e.subject}</p>}
              <p className="whitespace-pre-line text-sm text-text-2">{e.message}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={`mailto:${e.email}?subject=${encodeURIComponent("Re: " + (e.subject ?? tx("yourEnquiry")))}`}
                  onClick={() => e.status === "new" && setStatus.mutate({ id: e.id, status: "read" })}
                >
                  <Button size="sm" variant="secondary">
                    <Mail size={14} /> {tx("reply")}
                  </Button>
                </a>
                {NEXT.filter((s) => s !== e.status).map((s) => (
                  <Button key={s} size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: e.id, status: s })}>
                    {tx(`mark_${s}`)}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}
