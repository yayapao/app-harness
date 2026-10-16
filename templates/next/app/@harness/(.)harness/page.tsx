import { HarnessDialog } from '@/components/harness/dialog';
import { getHarnessInitialData } from '@/lib/harness/initial-data';

export default async function Page() {
  return <HarnessDialog initialData={await getHarnessInitialData()} />;
}
