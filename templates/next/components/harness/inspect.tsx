import type { HarnessInitialData } from '@/types';
import { HarnessCapabilitiesList } from './capabilities';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statuses = {
  running: '运行中',
  completed: '完成',
  failed: '失败',
  stopped: '已停止',
};

export function HarnessInspect({
  view,
  data,
  onClose,
  onCloseAutoFocus,
}: {
  view: 'logs' | 'capabilities' | null;
  data: HarnessInitialData;
  onClose: () => void;
  onCloseAutoFocus: () => void;
}) {
  return (
    <Dialog
      open={view !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-lg sm:max-w-180"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {view === 'logs' ? '运行记录' : '已接入能力'}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] min-w-0 overflow-auto">
          {view === 'capabilities' ? (
            <HarnessCapabilitiesList capabilities={data.capabilities} />
          ) : data.logs.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">暂无记录</p>
          ) : (
            data.logs.map((log) => (
              <details key={log.id} className="border-b py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm">
                  <Badge
                    variant={
                      log.status === 'failed'
                        ? 'destructive'
                        : log.status === 'completed'
                          ? 'success'
                          : 'secondary'
                    }
                  >
                    {statuses[log.status]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{log.request}</span>
                  <time className="text-xs tabular-nums text-muted-foreground">
                    {new Date(log.startedAt).toLocaleString('zh-CN')}
                  </time>
                </summary>
                {log.error && (
                  <p className="mt-3 text-sm text-destructive">{log.error}</p>
                )}
                <ol className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
                  {log.trace?.map((entry) => (
                    <li key={entry.id} className="flex justify-between gap-2">
                      <span>{entry.label}</span>
                      {entry.durationMs !== undefined && (
                        <span className="tabular-nums">
                          {entry.durationMs}ms
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
