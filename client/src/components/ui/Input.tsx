import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-state-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-charcoal-600">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, className, ...rest }, ref) => (
  <FieldWrapper label={label} error={error} hint={hint}>
    <input ref={ref} className={cn("input", error && "border-state-danger focus:ring-red-500/30 focus:border-state-danger", className)} {...rest} />
  </FieldWrapper>
));
Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, hint, className, children, ...rest }, ref) => (
  <FieldWrapper label={label} error={error} hint={hint}>
    <select ref={ref} className={cn("input", error && "border-state-danger", className)} {...rest}>
      {children}
    </select>
  </FieldWrapper>
));
Select.displayName = "Select";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, hint, className, ...rest }, ref) => (
  <FieldWrapper label={label} error={error} hint={hint}>
    <textarea ref={ref} className={cn("input min-h-[96px] resize-y", error && "border-state-danger", className)} {...rest} />
  </FieldWrapper>
));
Textarea.displayName = "Textarea";
