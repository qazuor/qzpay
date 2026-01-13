import { useTranslation } from 'react-i18next';
import { useWizardStore } from '../../stores/wizard.store';
import { WizardProgress } from './WizardProgress';
import { WizardStepContent } from './WizardStepContent';
import { WizardControls } from './WizardControls';

interface WizardOverlayProps {
  onNavigate: (view: string) => void;
}

export function WizardOverlay({ onNavigate }: WizardOverlayProps) {
  const { t } = useTranslation('wizard');
  const { isActive } = useWizardStore();

  if (!isActive) return null;

  return (
    <div className="wizard-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {}} // Prevent closing on backdrop click
      />

      {/* Wizard Panel */}
      <div
        className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {t('title')}
          </h3>
        </div>

        {/* Progress */}
        <div className="px-6 py-4">
          <WizardProgress />
        </div>

        {/* Content */}
        <div className="px-6 py-2">
          <WizardStepContent />
        </div>

        {/* Controls */}
        <div className="px-6 py-4">
          <WizardControls onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
