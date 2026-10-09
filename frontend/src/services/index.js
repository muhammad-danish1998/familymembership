import * as mockAdapter from './mock/index.js';
import * as supabaseAdapter from './supabase/index.js';

const dataSource = import.meta.env.VITE_DATA_SOURCE || 'supabase';

const adapter = dataSource === 'mock' ? mockAdapter : supabaseAdapter;

export const auth = adapter.auth;
export const family = adapter.family;
export const fund = adapter.fund;
export const members = adapter.members;
export const payments = adapter.payments;
export const cases = adapter.cases;
export const executives = adapter.executives;
export const settings = adapter.settings;
export const audit = adapter.audit;
export const exporter = adapter.exporter || mockAdapter.exporter;

export const isMockMode = dataSource === 'mock';

