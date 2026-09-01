import { RequireAuth } from "@/components/auth/require-auth";

export default function ProfilLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
