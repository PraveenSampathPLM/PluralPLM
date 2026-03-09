import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
}
export declare function FloatingInput({ label, className, ...props }: FloatingInputProps): JSX.Element;
interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
}
export declare function FloatingTextarea({ label, className, ...props }: FloatingTextareaProps): JSX.Element;
interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
}
export declare function FloatingSelect({ label, className, value, children, ...props }: FloatingSelectProps): JSX.Element;
export {};
