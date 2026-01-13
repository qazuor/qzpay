import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizardStore, WIZARD_STEPS } from '../../stores/wizard.store';
import { Check } from 'lucide-react';

export function WizardProgress() {
  const { t } = useTranslation('wizard');
  const { currentStepIndex, completedSteps, goToStep } = useWizardStore();

  // Calculate progress from primitive values to avoid infinite loop
  const progress = useMemo(() => {
    const total = WIZARD_STEPS.length;
    return {
      current: currentStepIndex + 1,
      total,
      percentage: Math.round(((currentStepIndex + 1) / total) * 100),
    };
  }, [currentStepIndex]);

  return (
    <div className="wizard-progress">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {t('progress.step', { current: progress.current, total: progress.total })}
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {progress.percentage}%
        </span>
      </div>

      {/* Progress track */}
      <div
        className="h-2 rounded-full overflow-hidden mb-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress.percentage}%`,
            backgroundColor: 'var(--color-accent)',
          }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = index === currentStepIndex;
          const isClickable = index <= currentStepIndex || isCompleted;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && goToStep(index)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1 px-2 transition-all ${
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
              title={t(step.titleKey)}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isCurrent ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{
                  backgroundColor: isCompleted
                    ? 'var(--color-success)'
                    : isCurrent
                    ? 'var(--color-accent)'
                    : 'var(--color-surface)',
                  color: isCompleted || isCurrent ? 'white' : 'var(--color-text-muted)',
                  '--tw-ring-color': 'var(--color-accent)',
                  '--tw-ring-offset-color': 'var(--color-background)',
                } as React.CSSProperties}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <span
                className="text-xs whitespace-nowrap hidden sm:block"
                style={{
                  color: isCurrent ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}
              >
                {t(step.titleKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
