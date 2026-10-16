import { HarnessPanel } from '@/components/harness/panel';
import { getHarnessInitialData } from '@/lib/harness/initial-data';

export const metadata = { title: 'AI 对话' };
export const dynamic = 'force-dynamic';

export default async function HarnessPage() {
  const initialData = await getHarnessInitialData();
  return <HarnessPanel initialData={initialData} />;
}
