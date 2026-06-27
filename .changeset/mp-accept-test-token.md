---
"@qazuor/qzpay-mercadopago": patch
---

Accept MercadoPago access tokens with a `TEST-` prefix in addition to `APP_USR-`.

Some MercadoPago applications issue their Test credentials with a legacy `TEST-` prefix. The adapter constructor previously rejected these, throwing `Invalid MercadoPago access token format` and preventing billing initialization on sandbox/staging environments configured with such a token. Both `APP_USR-` and `TEST-` prefixes are now accepted; any other format is still rejected.
