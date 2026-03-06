// Toggle between mock and live API
// 'mock' = always mock, 'live' = try n8n first then fall back to mock
const MODE = 'live';
const N8N_WEBHOOK_URL =
  'http://localhost:5678/webhook/9e501223-34e5-48eb-a04c-a22959509df8';

import { companies as companiesData, disruptions as disruptionsData } from './supplyChainData';
import responsesData from '../mocks/responses.json';

export async function getCompanies() {
  return companiesData;
}

export async function getDisruptions(companyId) {
  return disruptionsData[companyId] || [];
}

/**
 * Main Analysis Engine
 * Sends company and disruption context to n8n (Gemini)
 */
export async function analyzeDisruption(companyId, disruptionId) {
  const mockKey = `${companyId}_${disruptionId}`;
  const mockResponse = responsesData[mockKey] || Object.values(responsesData)[0];

  if (MODE === 'mock') {
    return mockResponse;
  }

  try {
    const company = companiesData.find(c => c.id === companyId);
    const disruptions = disruptionsData[companyId] || [];
    const disruption = disruptions.find(d => d.id === disruptionId);

    // 1. Build the prompt with strict JSON instructions
    const chatInput = buildPrompt(company, disruption);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout for LLM

    // 2. Call the n8n Webhook
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput,
        companyId,
        disruptionId,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`n8n returned ${res.status}`);

    const rawResponse = await res.text();
    console.log('=== N8N RAW RESPONSE ===');
    console.log(rawResponse);

    if (!rawResponse) {
      throw new Error(`n8n returned an empty response. Make sure the Webhook node's 'Respond' setting is set to 'Using Respond to Webhook Node' or 'Last Node'.`);
    }

    let data;
    try {
      data = JSON.parse(rawResponse);
      console.log('=== PARSED AS JSON (top-level) ===');
      console.log('Keys:', Object.keys(data));
      console.log(data);
    } catch (e) {
      console.warn("n8n response was not JSON, treating as raw text");
      data = { output: rawResponse };
    }

    // 3. Extract text from n8n response structure
    const agentRawText = data.output || data.text || (typeof data === 'string' ? data : JSON.stringify(data));
    console.log('=== AGENT RAW TEXT ===');
    console.log(agentRawText);

    // 4. Attempt to parse JSON from the agent's response
    try {
      // Find JSON block if the agent included markdown backticks or filler text
      const jsonMatch = agentRawText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : agentRawText;
      const parsedData = JSON.parse(jsonString);

      console.log('=== PARSED AGENT JSON ===');
      console.log('Keys:', Object.keys(parsedData));
      console.log(parsedData);

      const finalResponse = {
        ...mockResponse,
        ...parsedData,
        _live: true,
        _debug: 'Parsed JSON successfully'
      };
      console.log('=== FINAL MERGED RESPONSE ===');
      console.log(finalResponse);
      return finalResponse;
    } catch (parseError) {
      console.warn('Could not parse agent response as JSON, falling back to text-only update.');
      console.log('Parse error:', parseError.message);
      return {
        ...mockResponse,
        explanation: agentRawText,
        _live: true,
        _fallbackToText: true
      };
    }

  } catch (err) {
    console.error('n8n connection failed. Falling back to Mock Data:', err.message);
    return {
      ...mockResponse,
      _live: false,
      _error: err.message,
      _isFallback: true
    };
  }
}

/**
 * Prompt Engineering for the Master Agent
 */
function buildPrompt(company, disruption) {
  if (!company || !disruption) {
    return 'Analyze general supply chain risk.';
  }

  // Build supplier context from supply chain data
  const supplierList = (company._suppliers || []).map(s => `${s.name} (${s.country}, OTIF: ${s.reliability_otif_pct})`).join(', ');
  // Build critical parts context
  const criticalParts = (company._parts || []).filter(p => p.is_line_stop === 'True').map(p => `${p.description} (lead: ${p.normal_lead_time_days}d)`).join(', ');

  return `
    Analyze disruption risk for the following:
    
    Company: ${company.name} (${company.industry})
    Region: ${company.region}
    Critical Component: ${company.critical_component}
    Lead Time: ${company.lead_time_days} days
    Sourcing Strategy: ${company.sourcing}
    Risk Tolerance: ${company.risk_tolerance}
    Inventory Buffer: ${company.inventory_buffer}
    
    Suppliers: ${supplierList || 'N/A'}
    Critical Parts: ${criticalParts || 'N/A'}
    
    Disruption: ${disruption.title}
    Type: ${disruption.type}
    Severity: ${disruption.severity}
    Details: ${disruption.details || 'N/A'}
    Transit Impact: +${disruption.delta_transit_days || 0} days
  `.trim();
}

export async function submitFeedback(payload) {
  console.log('Feedback submitted:', payload);
  // Optional: Send feedback back to n8n to "train" the agent
  return { ok: true };
}