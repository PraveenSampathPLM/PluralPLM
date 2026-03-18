import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FloatingInput({ label, className = "", ...props }: FloatingInputProps): JSX.Element {
  return (
    <div className="relative">
      <input
        {...props}
        placeholder=" "
        className={`peer w-full rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}`}
      />
      <label className="pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-slate-500">
        {label}
      </label>
    </div>
  );
}

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export function FloatingTextarea({ label, className = "", ...props }: FloatingTextareaProps): JSX.Element {
  return (
    <div className="relative">
      <textarea
        {...props}
        placeholder=" "
        className={`peer w-full rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}`}
      />
      <label className="pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-slate-500">
        {label}
      </label>
    </div>
  );
}

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function FloatingSelect({ label, className = "", value, children, ...props }: FloatingSelectProps): JSX.Element {
  return (
    <div className="relative">
      <select
        {...props}
        value={value}
        className={`peer w-full appearance-none rounded border border-slate-300 bg-white px-3 pb-2 pt-5 text-sm focus:border-primary focus:outline-none ${className}`}
      >
        {children}
      </select>
      <label className="pointer-events-none absolute left-3 top-2 bg-white px-1 text-xs text-slate-500 transition-all peer-focus:text-slate-500">
        {label}
      </label>
    </div>
  );
}
