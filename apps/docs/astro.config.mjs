import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
    integrations: [
        starlight({
            title: 'QZPay',
            logo: {
                light: './src/assets/logo-light.svg',
                dark: './src/assets/logo-dark.svg',
                replacesTitle: false
            },
            social: {
                github: 'https://github.com/qazuor/qzpay'
            },
            defaultLocale: 'en',
            locales: {
                en: {
                    label: 'English',
                    lang: 'en'
                },
                es: {
                    label: 'Español',
                    lang: 'es'
                }
            },
            sidebar: [
                {
                    label: 'Getting Started',
                    translations: { es: 'Comenzando' },
                    items: [
                        { slug: 'getting-started/introduction' },
                        { slug: 'getting-started/installation' },
                        { slug: 'getting-started/quick-start' }
                    ]
                },
                {
                    label: 'Core Concepts',
                    translations: { es: 'Conceptos Base' },
                    items: [
                        { slug: 'concepts/architecture' },
                        { slug: 'concepts/customers' },
                        { slug: 'concepts/subscriptions' },
                        { slug: 'concepts/payments' },
                        { slug: 'concepts/entitlements' },
                        { slug: 'concepts/webhooks' }
                    ]
                },
                {
                    label: 'Packages',
                    translations: { es: 'Paquetes' },
                    items: [
                        { slug: 'packages/core' },
                        { slug: 'packages/stripe' },
                        { slug: 'packages/mercadopago' },
                        { slug: 'packages/drizzle' },
                        { slug: 'packages/hono' },
                        { slug: 'packages/nestjs' },
                        { slug: 'packages/react' },
                        { slug: 'packages/cli' }
                    ]
                },
                {
                    label: 'Guides',
                    translations: { es: 'Guías' },
                    items: [
                        { slug: 'guides/stripe-integration' },
                        { slug: 'guides/mercadopago-integration' },
                        { slug: 'guides/mercadopago-testing' },
                        { slug: 'guides/saved-cards' },
                        { slug: 'guides/subscription-lifecycle' },
                        { slug: 'guides/webhook-handling' },
                        { slug: 'guides/webhook-events' },
                        { slug: 'guides/payment-errors' },
                        { slug: 'guides/promo-codes' },
                        { slug: 'guides/addons' },
                        { slug: 'guides/metrics' },
                        { slug: 'guides/testing' },
                        { slug: 'guides/i18n' },
                        { slug: 'guides/styling-components' },
                        { slug: 'guides/creating-adapters' }
                    ]
                },
                {
                    label: 'API Reference',
                    translations: { es: 'Referencia API' },
                    autogenerate: { directory: 'api' }
                },
                {
                    label: 'Resources',
                    translations: { es: 'Recursos' },
                    items: [
                        { slug: 'resources/troubleshooting' },
                        { slug: 'resources/faq' },
                        { slug: 'resources/migration' },
                        { slug: 'resources/changelog' },
                        { slug: 'resources/roadmap' }
                    ]
                },
                {
                    label: 'Community',
                    translations: { es: 'Comunidad' },
                    items: [
                        { slug: 'community/contributing' },
                        { slug: 'community/code-of-conduct' },
                        { slug: 'community/support' }
                    ]
                }
            ],
            customCss: ['./src/styles/custom.css'],
            head: [
                {
                    tag: 'meta',
                    attrs: {
                        name: 'og:image',
                        content: '/og-image.png'
                    }
                }
            ],
            editLink: {
                baseUrl: 'https://github.com/qazuor/qzpay/edit/main/apps/docs/'
            },
            lastUpdated: true
        })
    ]
});
