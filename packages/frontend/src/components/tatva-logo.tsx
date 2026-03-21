import logoUrl from "@/assets/tatva-logo.svg";

interface TatvaLogoProps {
  compact?: boolean;
}

export function TatvaLogo({ compact = false }: TatvaLogoProps): JSX.Element {
  if (compact) {
    // Tricolor dot-ring — icon only for collapsed sidebar
    return (
      <svg width="36" height="36" viewBox="0 0 72 72" aria-label="Tatva" fill="none">
        <circle cx="36" cy="36" r="26" stroke="#E2E8F0" strokeWidth="1.5"/>
        {/* Saffron dot — top */}
        <circle cx="36" cy="10" r="7" fill="#FF9933"/>
        {/* Green dot — bottom-right */}
        <circle cx="58.5" cy="49" r="7" fill="#138808"/>
        {/* Navy dot — bottom-left */}
        <circle cx="13.5" cy="49" r="7" fill="#1A237E"/>
        {/* Centre nucleus */}
        <circle cx="36" cy="36" r="5" fill="#1A237E"/>
        <circle cx="36" cy="36" r="2.5" fill="white"/>
      </svg>
    );
  }

  return (
    <img src={logoUrl} alt="Tatva — Product Lifecycle Management" className="h-12 w-auto" />
  );
}
