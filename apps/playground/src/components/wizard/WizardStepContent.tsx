import { useTranslation } from 'react-i18next';
import { useWizardStore } from '../../stores/wizard.store';
import {
  Rocket,
  Settings,
  LayoutGrid,
  DollarSign,
  Users,
  CreditCard,
  Zap,
  Activity,
  Box,
  PartyPopper,
  HelpCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';

const STEP_ICONS: Record<string, ReactNode> = {
  welcome: <Rocket className="w-8 h-8" />,
  setup: <Settings className="w-8 h-8" />,
  plans: <LayoutGrid className="w-8 h-8" />,
  prices: <DollarSign className="w-8 h-8" />,
  customers: <Users className="w-8 h-8" />,
  subscriptions: <CreditCard className="w-8 h-8" />,
  actions: <Zap className="w-8 h-8" />,
  events: <Activity className="w-8 h-8" />,
  components: <Box className="w-8 h-8" />,
  complete: <PartyPopper className="w-8 h-8" />,
};

export function WizardStepContent() {
  const { t } = useTranslation('wizard');
  const currentStep = useWizardStore((state) => state.getCurrentStep());

  if (!currentStep) return null;

  const icon = STEP_ICONS[currentStep.id] || <HelpCircle className="w-8 h-8" />;

  return (
    <div className="wizard-step-content text-center py-4">
      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
        style={{
          backgroundColor: 'var(--color-accent-low)',
          color: 'var(--color-accent)',
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
        {t(currentStep.titleKey)}
      </h2>

      {/* Description */}
      <p
        className="text-sm max-w-md mx-auto mb-4"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t(currentStep.descriptionKey)}
      </p>

      {/* Tips for specific steps */}
      {currentStep.id !== 'welcome' && currentStep.id !== 'complete' && (
        <div
          className="text-xs p-3 rounded-lg max-w-md mx-auto"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-muted)',
          }}
        >
          <strong>{t('tips.label')}:</strong> {t(`tips.${currentStep.id}`)}
        </div>
      )}

      {/* Completion message */}
      {currentStep.id === 'complete' && (
        <div
          className="p-4 rounded-lg max-w-md mx-auto mt-4"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgba(34, 197, 94, 0.3)',
            border: '1px solid',
          }}
        >
          <p className="text-sm text-green-400">{t('complete.message')}</p>
        </div>
      )}
    </div>
  );
}
