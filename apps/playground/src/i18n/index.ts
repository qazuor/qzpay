import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English namespaces
import enCommon from './locales/en/common.json';
import enWelcome from './locales/en/welcome.json';
import enSetup from './locales/en/setup.json';
import enCatalog from './locales/en/catalog.json';
import enSimulation from './locales/en/simulation.json';
import enVisualization from './locales/en/visualization.json';
import enComponents from './locales/en/components.json';
import enShowcase from './locales/en/showcase.json';
import enWizard from './locales/en/wizard.json';
import enSidebar from './locales/en/sidebar.json';

// Spanish namespaces
import esCommon from './locales/es/common.json';
import esWelcome from './locales/es/welcome.json';
import esSetup from './locales/es/setup.json';
import esCatalog from './locales/es/catalog.json';
import esSimulation from './locales/es/simulation.json';
import esVisualization from './locales/es/visualization.json';
import esComponents from './locales/es/components.json';
import esShowcase from './locales/es/showcase.json';
import esWizard from './locales/es/wizard.json';
import esSidebar from './locales/es/sidebar.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        welcome: enWelcome,
        setup: enSetup,
        catalog: enCatalog,
        simulation: enSimulation,
        visualization: enVisualization,
        components: enComponents,
        showcase: enShowcase,
        wizard: enWizard,
        sidebar: enSidebar,
      },
      es: {
        common: esCommon,
        welcome: esWelcome,
        setup: esSetup,
        catalog: esCatalog,
        simulation: esSimulation,
        visualization: esVisualization,
        components: esComponents,
        showcase: esShowcase,
        wizard: esWizard,
        sidebar: esSidebar,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'welcome', 'setup', 'catalog', 'simulation', 'visualization', 'components', 'showcase', 'wizard', 'sidebar'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'qzpay_playground_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
