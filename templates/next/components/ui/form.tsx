'use client';

import * as React from 'react';
import { Slot } from 'radix-ui';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Form = FormProvider;
const FieldContext = React.createContext<{ name: string } | null>(null);
const ItemContext = React.createContext<{ id: string } | null>(null);

function FormField<T extends FieldValues, N extends FieldPath<T>>({
  ...props
}: ControllerProps<T, N>) {
  return (
    <FieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FieldContext.Provider>
  );
}

function useFormField() {
  const field = React.useContext(FieldContext);
  const item = React.useContext(ItemContext);
  const context = useFormContext();
  const formState = useFormState({ name: field?.name });
  if (!field || !item || !context)
    throw new Error('Form controls require Form, FormField and FormItem');
  const state = context.getFieldState(field.name, formState);
  return {
    ...state,
    name: field.name,
    formItemId: `${item.id}-control`,
    formDescriptionId: `${item.id}-description`,
    formMessageId: `${item.id}-message`,
  };
}

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();
  return (
    <ItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn('grid gap-2', className)}
        {...props}
      />
    </ItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      htmlFor={formItemId}
      className={cn(error && 'text-destructive', className)}
      {...props}
    />
  );
}

function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formMessageId } = useFormField();
  return (
    <Slot.Root
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={error ? formMessageId : undefined}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      id={formDescriptionId}
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : children;
  return body ? (
    <p
      id={formMessageId}
      role="alert"
      className={cn('text-xs text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  ) : null;
}

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
};
