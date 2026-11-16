import { Hammer } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/states";

export function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<Hammer className="h-8 w-8" />} title="Not built yet" description={`This page arrives in the ${step} step.`} />
    </>
  );
}
