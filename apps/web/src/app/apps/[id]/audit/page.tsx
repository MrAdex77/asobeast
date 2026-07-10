import { notFound } from "next/navigation";
import { AuditView } from "@/components/audit/AuditView";
import { ApiError, getAudit } from "@/lib/api";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = await getAudit(id).catch((err) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    return null;
  });
  if (!audit) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Audit is not available for this app yet.
      </div>
    );
  }

  return <AuditView appId={id} audit={audit} />;
}
