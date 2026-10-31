import { LabClient } from "@/components/lab/LabClient";

export default function LabPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Visual lab</h1>
        <p className="text-sm text-muted-foreground">
          Change the inputs and watch the mechanics: how balances accrue and fall, where each annuity factor leaves its value, how bonds move to par, and why convexity matters.
        </p>
      </div>
      <LabClient />
    </main>
  );
}
