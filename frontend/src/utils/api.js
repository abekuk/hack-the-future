// Toggle between mock and live API
const USE_MOCK = true;
const BASE_URL = '/api';

import companiesData from '../mocks/companies.json';
import disruptionsData from '../mocks/disruptions.json';
import responsesData from '../mocks/responses.json';

export async function getCompanies() {
  if (USE_MOCK) return companiesData;
  const res = await fetch(`${BASE_URL}/companies`);
  return res.json();
}

export async function getDisruptions(companyId) {
  if (USE_MOCK) return disruptionsData[companyId] || [];
  const res = await fetch(`${BASE_URL}/disruptions?company_id=${companyId}`);
  return res.json();
}

export async function analyzeDisruption(companyId, disruptionId) {
  if (USE_MOCK) {
    const key = `${companyId}_${disruptionId}`;
    // Return first available response if exact match not found
    return responsesData[key] || Object.values(responsesData)[0];
  }
  const res = await fetch(`${BASE_URL}/agent/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_id: companyId, disruption_id: disruptionId }),
  });
  return res.json();
}

export async function submitFeedback(payload) {
  if (USE_MOCK) {
    console.log('Feedback submitted (mock):', payload);
    return { ok: true };
  }
  const res = await fetch(`${BASE_URL}/agent/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
