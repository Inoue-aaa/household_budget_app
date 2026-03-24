import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { MobileAppShell } from "@/components/MobileAppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <MobileAppShell>{children}</MobileAppShell>
      <BottomNav />
    </>
  );
}
