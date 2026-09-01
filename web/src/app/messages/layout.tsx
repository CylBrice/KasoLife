import { RequireAuth } from "@/components/auth/require-auth";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
