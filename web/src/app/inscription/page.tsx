"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";

function InscriptionInner() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || undefined;
  return <AuthCard initialTab="signup" referralCode={ref} />;
}

export default function InscriptionPage() {
  return (
    <Suspense>
      <InscriptionInner />
    </Suspense>
  );
}
