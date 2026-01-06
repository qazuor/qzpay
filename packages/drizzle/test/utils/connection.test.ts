/**
 * Connection Utilities Tests
 */
import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl, parseDatabaseUrl } from '../../src/utils/connection.js';

describe('Connection Utilities', () => {
    describe('parseDatabaseUrl', () => {
        it('should parse a full database URL', () => {
            const result = parseDatabaseUrl('postgresql://myuser:mypassword@localhost:5432/mydb');

            expect(result.host).toBe('localhost');
            expect(result.port).toBe(5432);
            expect(result.database).toBe('mydb');
            expect(result.user).toBe('myuser');
            expect(result.password).toBe('mypassword');
            expect(result.ssl).toBe(false);
        });

        it('should parse URL with SSL mode', () => {
            const result = parseDatabaseUrl('postgresql://user:pass@host:5432/db?sslmode=require');

            expect(result.ssl).toBe(true);
        });

        it('should use default port when not specified', () => {
            const result = parseDatabaseUrl('postgresql://user:pass@localhost/mydb');

            expect(result.port).toBe(5432);
        });

        it('should handle special characters in password', () => {
            const result = parseDatabaseUrl('postgresql://user:p%40ss%23word@localhost:5432/db');

            // URL parser decodes percent-encoded characters
            expect(result.password).toBe('p%40ss%23word');
        });

        it('should parse URL without SSL param', () => {
            const result = parseDatabaseUrl('postgresql://user:pass@host:5432/db?other=value');

            expect(result.ssl).toBe(false);
        });

        it('should handle empty password', () => {
            const result = parseDatabaseUrl('postgresql://user:@localhost:5432/mydb');

            expect(result.user).toBe('user');
            expect(result.password).toBe('');
        });
    });

    describe('buildDatabaseUrl', () => {
        it('should build a basic database URL', () => {
            const result = buildDatabaseUrl({
                host: 'localhost',
                port: 5432,
                database: 'qzpay_dev',
                user: 'postgres',
                password: 'secret'
            });

            expect(result).toBe('postgresql://postgres:secret@localhost:5432/qzpay_dev');
        });

        it('should include SSL param when specified', () => {
            const result = buildDatabaseUrl({
                host: 'production.db.com',
                database: 'qzpay_prod',
                user: 'admin',
                password: 'secure123',
                ssl: true
            });

            expect(result).toBe('postgresql://admin:secure123@production.db.com:5432/qzpay_prod?sslmode=require');
        });

        it('should use default port when not specified', () => {
            const result = buildDatabaseUrl({
                host: 'localhost',
                database: 'test',
                user: 'user',
                password: 'pass'
            });

            expect(result).toContain(':5432/');
        });

        it('should encode special characters in user and password', () => {
            const result = buildDatabaseUrl({
                host: 'localhost',
                database: 'db',
                user: 'user@domain',
                password: 'p@ss#word!'
            });

            expect(result).toContain('user%40domain');
            expect(result).toContain('p%40ss%23word!');
        });

        it('should not include SSL param when ssl is false', () => {
            const result = buildDatabaseUrl({
                host: 'localhost',
                database: 'db',
                user: 'user',
                password: 'pass',
                ssl: false
            });

            expect(result).not.toContain('sslmode');
        });

        it('should roundtrip with parseDatabaseUrl', () => {
            const config = {
                host: 'myhost.com',
                port: 5433,
                database: 'testdb',
                user: 'testuser',
                password: 'testpass',
                ssl: true
            };

            const url = buildDatabaseUrl(config);
            const parsed = parseDatabaseUrl(url);

            expect(parsed.host).toBe(config.host);
            expect(parsed.port).toBe(config.port);
            expect(parsed.database).toBe(config.database);
            expect(parsed.user).toBe(config.user);
            expect(parsed.password).toBe(config.password);
            expect(parsed.ssl).toBe(config.ssl);
        });
    });
});
