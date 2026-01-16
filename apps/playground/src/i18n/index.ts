import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCatalog from './locales/en/catalog.json';
// English namespaces
import enCommon from './locales/en/common.json';
import enComponents from './locales/en/components.json';
import enSetup from './locales/en/setup.json';
import enShowcase from './locales/en/showcase.json';
import enSidebar from './locales/en/sidebar.json';
import enSimulation from './locales/en/simulation.json';
import enTour from './locales/en/tour.json';
import enVisualization from './locales/en/visualization.json';
import enWelcome from './locales/en/welcome.json';

import esCatalog from './locales/es/catalog.json';
// Spanish namespaces
import esCommon from './locales/es/common.json';
import esComponents from './locales/es/components.json';
import esSetup from './locales/es/setup.json';
import esShowcase from './locales/es/showcase.json';
import esSidebar from './locales/es/sidebar.json';
import esSimulation from './locales/es/simulation.json';
import esTour from './locales/es/tour.json';
import esVisualization from './locales/es/visualization.json';
import esWelcome from './locales/es/welcome.json';

i18n.use(LanguageDetector)
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
                sidebar: enSidebar,
                tour: enTour
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
                sidebar: esSidebar,
                tour: esTour
            }
        },
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'welcome', 'setup', 'catalog', 'simulation', 'visualization', 'components', 'showcase', 'sidebar', 'tour'],
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            lookupLocalStorage: 'qzpay_playground_language',
            caches: ['localStorage']
        }
    });

export default i18n;
