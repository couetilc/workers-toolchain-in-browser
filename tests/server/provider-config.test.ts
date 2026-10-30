import { expect, it } from 'vitest';
import { providerConfig } from '../../src/provider-config';

it('uses free-only OpenRouter defaults and accepts explicit free models', () => {
  expect(providerConfig({ OPENROUTER_API_KEY: 'secret' })).toMatchObject({ apiKey: 'secret', model: { id: 'openrouter/free', provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' } });
  expect(providerConfig({ OPENROUTER_API_KEY: 'secret', OPENROUTER_MODEL: 'example:free' }).model.id).toBe('example:free');
  expect(() => providerConfig({ OPENROUTER_API_KEY: 'secret', OPENROUTER_MODEL: 'paid/model' })).toThrow('Only free');
});
it('keeps explicit fixture configuration independent of local credentials and requires all fields', () => {
  expect(providerConfig({ MODEL_API_KEY: 'fixture', MODEL_BASE_URL: 'http://fixture.test', MODEL_ID: 'fixture', OPENROUTER_API_KEY: 'unused' }).model.provider).toBe('openai');
  for (const env of [{}, { MODEL_API_KEY: 'a' }, { MODEL_API_KEY: 'a', MODEL_BASE_URL: 'url' }]) expect(() => providerConfig(env)).toThrow('Set OPENROUTER');
});
