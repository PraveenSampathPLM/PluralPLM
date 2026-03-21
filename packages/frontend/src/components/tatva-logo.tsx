import logoUrl from "@/assets/tatva-logo.svg";

interface TatvaLogoProps {
  compact?: boolean;
}

export function TatvaLogo({ compact = false }: TatvaLogoProps): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      {compact ? (
        <svg width={28} height={28} viewBox="0 0 34 34" aria-hidden="true">
          <defs>
            <linearGradient id="tatvaLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1B4F72" />
              <stop offset="100%" stopColor="#E67E22" />
            </linearGradient>
          </defs>
          <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#0F2027" />
          <path
            d="M9 9h8.4c4.4 0 7.1 2.3 7.1 6.2 0 3.9-2.7 6.2-7.1 6.2h-4.2V25H9V9Zm8.2 9.3c2 0 3.1-1 3.1-2.9s-1.1-2.8-3.1-2.8h-4v5.7h4Z"
            fill="url(#tatvaLogoGrad)"
          />
        </svg>
      ) : (
        <img src={logoUrl} alt="Tatva" className="h-8 w-auto" />
      )}
    </div>
  );
}
