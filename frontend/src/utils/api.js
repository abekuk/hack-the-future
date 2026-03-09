// Toggle between mock and live API
// 'mock' = always mock, 'live' = try n8n first then fall back to mock
const MODE = 'live';
const N8N_WEBHOOK_URL =
  'http://localhost:5670/webhook/9e501223-34e5-48eb-a04c-a22959509df8';

import { companies as companiesData, disruptions as disruptionsData } from './supplyChainData';
import responsesData from '../mocks/responses.json';

const liveNewsCache = {}; // Cache to prevent Vertex AI rate limit exhaustion

export async function getCompanies() {
  return companiesData;
}

export function getMockDisruptions(companyId) {
  let mockDisruptions = disruptionsData[companyId] || [];
  return mockDisruptions.map(d => ({
    ...d,
    title: `(MOCK) ${d.title}`
  }));
}

export async function getDisruptions(companyId, company = null) {
  const mockDisruptions = getMockDisruptions(companyId);

  if (MODE === 'mock' || !company) {
    return mockDisruptions;
  }

  // Check cache to prevent Rate Limit (429) errors from Vertex AI
  const now = Date.now();
  if (liveNewsCache[companyId] && now - liveNewsCache[companyId].timestamp < 5 * 60 * 1000) {
    console.log(`[Cache Hit] Returning live news for ${companyId}`);
    return [...liveNewsCache[companyId].data, ...mockDisruptions];
  }

  try {
    // Call the new n8n Webhook which triggers the Perception Agent
    const chatPrompt = `
      TASK: Fetch Live News
      COMPANY CONTEXT:
      - Industry: ${company.industry}
      - Region: ${company.region}
      - Critical Component: ${company.critical_component}

      AGENT INSTRUCTIONS - SEARCHING (Tavily API):
      1. Use the HTTP Request Tool (Tavily).
      2. Since you are using Tavily (an AI Search API), DO NOT use short keywords or boolean operators.
      3. Instead, formulate a highly specific, natural language question that includes the region, industry, and component. Example: "What are the latest real-world supply chain disruptions, port strikes, material shortages, or geopolitical risks affecting ${company.critical_component} production in ${company.region}?"
      4. The company name '${company.name}' is MOCK. Do NOT mention the company name in your query.
      5. CRITICAL: When passing your question to the HTTP Request tool, the \`q\` parameter MUST be a plain text string. Do NOT pass a JSON object.
      
      AGENT INSTRUCTIONS - FILTERING & SELECTION:
      5. Once you have fetched articles, evaluate their relevance to the COMPANY CONTEXT.
      6. Select the top 3 most relevant real-world supply chain risks, delays, or disruptions.
      7. FALLBACK: If there are no hits for the highly specific component, you MUST broaden your search to regional supply chain disruptions affecting ${company.region} or the company's supplier countries. Prioritize major logistical or geopolitical events (e.g., wars, port strikes, canal blockages, trade route issues, natural disasters) that would indirectly impact their supply chain.
      8. You MUST always return exactly 3 real articles. Do NOT fabricate them. If you cannot find perfect matches, return the 3 best regional or geopolitical supply chain articles available.
      
      OUTPUT FORMAT:
      You MUST return exactly 3 distinct articles.
      You MUST return ONLY a raw JSON object and nothing else. NO conversational text.
      {"top_articles": [{"title":"...","description":"...","publishedAt":"..."}]}
    `.trim();

    const res = await fetch('http://localhost:5670/webhook/get-live-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput: chatPrompt,
        companyId: company.id,
        industry: company.industry,
        region: company.region,
        critical_component: company.critical_component,
        suppliers: company._suppliers || [],
        parts: company._parts || []
      })
    });

    if (!res.ok) throw new Error(`Failed to fetch live news from agent: ${res.statusText}`);
    const rawData = await res.text();
    let data;
    try {
      // Try to extract JSON if the agent wraps it in Markdown backticks
      const jsonMatch = rawData.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : rawData;
      data = JSON.parse(jsonString);
    } catch (e) {
      console.warn("Could not parse Agent news response as JSON:", rawData);
      data = { articles: [{ title: rawData, description: "Agent responded with plain text instead of JSON array.", publishedAt: new Date().toISOString() }] };
    }

    // Support either the Agent's structured {"top_articles": []} output or raw arrays
    const articles = data.top_articles || data.articles || (Array.isArray(data) ? data : []);

    if (articles && articles.length > 0) {
      const liveDisruptions = articles.map((article, idx) => ({
        id: `live_${companyId}_${idx}`,
        type: 'logistics',
        title: (article.title || '').substring(0, 70) + ((article.title || '').length > 70 ? '...' : ''),
        severity: idx === 0 ? 'critical' : (idx < 3 ? 'high' : 'medium'),
        region: company.region || 'Global',
        timestamp: article.publishedAt || new Date().toISOString(),
        details: article.description || article.content || 'Live news article.',
        delta_transit_days: Math.floor(Math.random() * 10) + 1, // Simulated impact
        icon: 'truck'
      }));

      // Combine live disruptions and mock disruptions, live first
      liveNewsCache[companyId] = {
        timestamp: Date.now(),
        data: liveDisruptions
      };
      return [...liveDisruptions, ...mockDisruptions];
    }
  } catch (err) {
    console.warn('Agent News fetch failed, falling back to mock disruptions:', err);
  }

  return mockDisruptions;
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
    TASK: Analyze Disruption
    
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

    CRITICAL INSTRUCTION:
    1. When generating the 'mitigation_options' array, every single option MUST include a 'cost_avoidance' numeric field representing the estimated savings. This is required for the frontend UI to display savings.
    2. You MUST generate EXACTLY 3 distinct mitigation options.
    3. EXACTLY ONE of the mitigation options can have 'recommended': true. The others MUST be false.
    4. You are operating as a backend API endpoint behind the scenes.
    5. DO NOT INTRODUCE YOURSELF. Do NOT say "Here is your analysis".
    6. You MUST return ONLY a raw JSON object and absolutely nothing else. No markdown backticks outside the JSON.
  `.trim();
}

export async function submitFeedback(payload) {
  console.log('Feedback submitted:', payload);
  // Optional: Send feedback back to n8n to "train" the agent
  return { ok: true };
}