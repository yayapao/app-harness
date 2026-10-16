import { Badge } from '@/components/ui/badge';
import { HarnessSettingsForm } from '@/components/harness/settings-form';
import { HarnessCapabilitiesList } from '@/components/harness/capabilities';
import { getHarnessSettingsData } from '@/lib/harness/initial-data';

export const metadata = { title: 'Harness 管理' };

export default async function HarnessSettingsPage() {
  const data = await getHarnessSettingsData();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="page-heading">Harness 管理</h1>
        <Badge variant={data.mode === 'demo' ? 'secondary' : 'info'}>
          {data.mode === 'demo' ? '演示' : '模型'}
        </Badge>
      </header>
      <HarnessSettingsForm initialData={data} />
      <HarnessCapabilitiesList capabilities={data.capabilities} />
    </div>
  );
}
