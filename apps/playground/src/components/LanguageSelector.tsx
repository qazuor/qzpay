import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
      <select
        value={i18n.language.split('-')[0]}
        onChange={handleLanguageChange}
        className="select text-sm py-1 px-2 bg-transparent border-none cursor-pointer"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
