'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SaveIcon } from '@animateicons/react/lucide/save-icon';
import { UndoIcon } from '@animateicons/react/lucide/undo-icon';
import { toast } from 'sonner';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import { TextureButton } from '@/components/ui/texture-button';
import { HaloInput } from '@/components/ui/halo-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { harnessSettingsSchema } from '@/harness/browser/settings';
import { saveHarnessSettings } from '@/app/settings/harness/actions';
import type { OrchestratorConfig } from '@/harness/core';
import type { HarnessSettingsData } from '@/types';

export function HarnessSettingsForm({
  initialData,
}: {
  initialData: HarnessSettingsData;
}) {
  const form = useForm<OrchestratorConfig>({
    resolver: zodResolver(harnessSettingsSchema),
    defaultValues: initialData.settings,
  });
  useEffect(
    () => form.reset(initialData.settings),
    [initialData.settings, form]
  );
  const busy = form.formState.isSubmitting;

  async function submit(values: OrchestratorConfig) {
    form.clearErrors('root');
    try {
      const result = await saveHarnessSettings(values);
      if (!result.settings) {
        form.setError('root', { message: result.error });
        return;
      }
      form.reset(result.settings);
      toast.success('配置已保存');
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : '保存失败',
      });
    }
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(submit)}
        className="flex flex-col gap-4"
      >
        <section
          aria-labelledby="runtime-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="runtime-heading" className="text-sm font-medium">
            运行参数
          </h2>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>模型</FormLabel>
                  <FormControl>
                    <HaloInput
                      {...field}
                      disabled={busy || initialData.mode === 'demo'}
                      trailingSlot={
                        initialData.mode === 'demo' ? '演示' : undefined
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxIterations"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>运行限额</FormLabel>
                  <FormControl>
                    <HaloInput
                      {...field}
                      type="number"
                      min={1}
                      max={32}
                      step={1}
                      disabled={busy}
                      trailingSlot="轮"
                      value={Number.isFinite(field.value) ? field.value : ''}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? NaN
                            : Number(event.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxTokens"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>单轮输出上限</FormLabel>
                  <FormControl>
                    <HaloInput
                      {...field}
                      type="number"
                      min={256}
                      max={64000}
                      step={1}
                      disabled={busy}
                      trailingSlot="tokens"
                      value={Number.isFinite(field.value) ? field.value : ''}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? NaN
                            : Number(event.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>
        {form.formState.errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t pt-4">
          <AnimatedIconButton
            icon={UndoIcon}
            label="恢复修改"
            disabled={busy || !form.formState.isDirty}
            onClick={() => form.reset()}
          />
          <TextureButton
            type="submit"
            variant="primary"
            disabled={busy || !form.formState.isDirty}
          >
            <SaveIcon isAnimated={false} aria-hidden />
            {busy ? '保存中' : '保存配置'}
          </TextureButton>
        </div>
      </form>
    </Form>
  );
}
