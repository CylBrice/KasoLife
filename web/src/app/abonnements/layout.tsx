import { RequireAuth } from "@/components/auth/require-auth";

export default function AbonnementsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
