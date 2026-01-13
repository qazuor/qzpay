import {
  ArrowRight,
  Box,
  CheckCircle,
  Code2,
  CreditCard,
  Database,
  FileText,
  Gift,
  Play,
  Settings,
  ShoppingCart,
  Users,
  Zap,
  Compass,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '../../stores/wizard.store';

interface WelcomePageProps {
  onGetStarted: () => void;
}

export function WelcomePage({ onGetStarted }: WelcomePageProps) {
  const { t } = useTranslation('welcome');
  const { t: tWizard } = useTranslation('wizard');
  const { isActive: isWizardActive, currentStepIndex, startWizard } = useWizardStore();

  const hasWizardProgress = isWizardActive || currentStepIndex > 0;

  const handleStartTour = () => {
    startWizard();
  };

  return (
    <div className="min-h-screen overflow-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
            <Zap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {t('hero.badge')}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
            {t('hero.title')}
          </h1>

          <p className="text-xl max-w-2xl mx-auto mb-8" style={{ color: 'var(--color-text-secondary)' }}>
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={onGetStarted}
              className="btn btn-primary px-8 py-4 text-lg group"
            >
              {t('hero.getStarted')}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>

            <button
              type="button"
              onClick={handleStartTour}
              className="btn px-6 py-4 text-lg group"
              style={{
                backgroundColor: 'var(--color-surface-elevated)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Compass className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              {hasWizardProgress ? tWizard('welcome.resumeTour') : tWizard('welcome.startTour')}
            </button>
          </div>

          <p className="text-sm mt-4" style={{ color: 'var(--color-text-muted)' }}>
            {tWizard('welcome.tourDescription')}
          </p>
      </div>

      {/* What is QZPay Section */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            {t('whatIsQzpay.title')}
          </h2>
          <p className="text-lg mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {t('whatIsQzpay.description')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
              <Database className="h-6 w-6 mb-2" style={{ color: 'var(--color-accent)' }} />
              <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                {t('whatIsQzpay.features.providerAgnostic.title')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('whatIsQzpay.features.providerAgnostic.description')}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
              <Code2 className="h-6 w-6 mb-2" style={{ color: 'var(--color-accent)' }} />
              <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                {t('whatIsQzpay.features.typeSafe.title')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('whatIsQzpay.features.typeSafe.description')}
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-surface-elevated)' }}>
              <Zap className="h-6 w-6 mb-2" style={{ color: 'var(--color-accent)' }} />
              <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                {t('whatIsQzpay.features.eventDriven.title')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {t('whatIsQzpay.features.eventDriven.description')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How the Playground Works */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: 'var(--color-text)' }}>
          {t('howItWorks.title')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)' }}>
                <Play className="h-5 w-5" style={{ color: 'var(--color-accent-high)' }} />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('howItWorks.mockMode.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('howItWorks.mockMode.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)' }}>
                <Database className="h-5 w-5" style={{ color: 'var(--color-accent-high)' }} />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('howItWorks.localStorage.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('howItWorks.localStorage.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)' }}>
                <Zap className="h-5 w-5" style={{ color: 'var(--color-accent-high)' }} />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('howItWorks.realTimeEvents.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('howItWorks.realTimeEvents.description')}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-accent-low)' }}>
                <Code2 className="h-5 w-5" style={{ color: 'var(--color-accent-high)' }} />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                  {t('howItWorks.exportReady.title')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('howItWorks.exportReady.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: 'var(--color-text)' }}>
          {t('workflow.title')}
        </h2>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--color-border)' }} />

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="md:w-1/2 md:text-right md:pr-8">
                <div className="card p-6 inline-block text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <Settings className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
                      {t('workflow.step1.label')}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('workflow.step1.title')}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('workflow.step1.description')}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex w-8 h-8 rounded-full items-center justify-center z-10" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                <span className="text-sm font-bold">1</span>
              </div>
              <div className="md:w-1/2" />
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="md:w-1/2" />
              <div className="hidden md:flex w-8 h-8 rounded-full items-center justify-center z-10" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                <span className="text-sm font-bold">2</span>
              </div>
              <div className="md:w-1/2 md:pl-8">
                <div className="card p-6 inline-block text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <Box className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
                      {t('workflow.step2.label')}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('workflow.step2.title')}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('workflow.step2.description')}
                  </p>
                  <ul className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                    <li className="flex items-center gap-2">
                      <ShoppingCart className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      <span>{t('workflow.step2.items.plans')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      <span>{t('workflow.step2.items.prices')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Gift className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      <span>{t('workflow.step2.items.addons')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      <span>{t('workflow.step2.items.promos')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="md:w-1/2 md:text-right md:pr-8">
                <div className="card p-6 inline-block text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <Users className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
                      {t('workflow.step3.label')}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('workflow.step3.title')}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('workflow.step3.description')}
                  </p>
                  <ul className="text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      {t('workflow.step3.items.createCustomers')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      {t('workflow.step3.items.processPayments')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      {t('workflow.step3.items.manageSubscriptions')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" style={{ color: 'var(--color-accent)' }} />
                      {t('workflow.step3.items.viewInvoices')}
                    </li>
                  </ul>
                </div>
              </div>
              <div className="hidden md:flex w-8 h-8 rounded-full items-center justify-center z-10" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                <span className="text-sm font-bold">3</span>
              </div>
              <div className="md:w-1/2" />
            </div>

            {/* Step 4 */}
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="md:w-1/2" />
              <div className="hidden md:flex w-8 h-8 rounded-full items-center justify-center z-10" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}>
                <span className="text-sm font-bold">4</span>
              </div>
              <div className="md:w-1/2 md:pl-8">
                <div className="card p-6 inline-block text-left">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-text-muted)' }}>
                      {t('workflow.step4.label')}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                    {t('workflow.step4.title')}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('workflow.step4.description')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
            {t('cta.title')}
          </h2>
          <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {t('cta.description')}
          </p>
          <button
            type="button"
            onClick={onGetStarted}
            className="btn btn-primary px-8 py-4 text-lg group"
          >
            <Play className="h-5 w-5" />
            {t('cta.button')}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('footer.partOf')} <a href="https://github.com/qazuor/qzpay" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--color-accent)' }}>@qazuor/qzpay</a> {t('footer.project')}
        </p>
      </div>
    </div>
  );
}
