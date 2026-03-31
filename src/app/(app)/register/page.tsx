import { RegisterTabPanel } from "@/features/app-shell/RegisterTabPanel";
import { getPendingImportsPageSnapshot } from "@/lib/finance/queries";

type RegisterPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { notice } = await searchParams;
  const snapshot = await getPendingImportsPageSnapshot();

  return <RegisterTabPanel noticeCode={notice} snapshot={snapshot} />;
}
