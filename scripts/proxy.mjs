import { proxyServer } from '../src/proxy.ts';
import { providerConfig } from '../src/provider-config.ts';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) loadEnvFile('.env');
proxyServer(providerConfig(process.env)).listen(4171, '127.0.0.1', () => console.log('Local model proxy on 4171'));
