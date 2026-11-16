import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/states";

export function JobTabPlaceholder({ step }: { step: string }) {
  return <EmptyState icon={<Hammer className="h-6 w-6" />} title="Not built yet" description={`This tab arrives in the ${step} step.`} />;
}
