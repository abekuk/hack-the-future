// Toggle between mock and live API
// 'mock' = always mock, 'live' = try n8n first then fall back to mock
const MODE = 'live';
const N8N_WEBHOOK_URL =
  'http://localhost:5670/webhook/9e501223-34e5-48eb-a04c-a22959509df8';

import { companies as companiesData, disruptions as disruptionsData } from './supplyChainData';
import responsesData from '../mocks/responses.json';

const liveNewsCache = {}; // Cache to prevent Vertex AI rate limit exhaustion

export function clearNewsCache(companyId) {
  if (companyId) {
    delete liveNewsCache[companyId];
  } else {
    Object.keys(liveNewsCache).forEach(k => delete liveNewsCache[k]);
  }
  console.log(`[Cache] Cleared news cache${companyId ? ` for ${companyId}` : ''}`);
}

// ============================================================
// NEWS RELEVANCE MEMORY — learns from user feedback on articles
// Designed to avoid echo chamber / fixation effects:
// - No keyword extraction (too crude, causes false suppressions)
// - Time-decayed entries (older feedback is deprioritized)
// - LLM prompt explicitly guards against filter bubbles
// ============================================================
const MEMORY_DECAY_DAYS = 7; // After 7 days, feedback is deprioritized

function loadNewsMemory(companyId) {
  try {
    const all = JSON.parse(localStorage.getItem('news_relevance_memory') || '{}');
    return all[companyId] || { liked: [], disliked: [] };
  } catch { return { liked: [], disliked: [] }; }
}

function saveNewsMemory(companyId, memory) {
  try {
    const all = JSON.parse(localStorage.getItem('news_relevance_memory') || '{}');
    all[companyId] = memory;
    localStorage.setItem('news_relevance_memory', JSON.stringify(all));
  } catch (e) { console.warn('Failed to persist news memory:', e); }
}

/**
 * Call this when the user marks a live disruption as relevant or irrelevant.
 * Stores the full article context (not just keywords) so the LLM can
 * understand WHY the user liked/disliked it.
 */
export function saveNewsRelevanceFeedback(companyId, article, relevant, reason = '') {
  const memory = loadNewsMemory(companyId);
  const entry = {
    title: article.title,
    details: article.details || '',  // Full description for context
    type: article.type,
    severity: article.severity,
    reason,
    timestamp: new Date().toISOString(),
  };

  if (relevant) {
    memory.liked.push(entry);
  } else {
    memory.disliked.push(entry);
  }

  // Keep memory bounded (last 15 entries per list)
  memory.liked = memory.liked.slice(-15);
  memory.disliked = memory.disliked.slice(-15);

  saveNewsMemory(companyId, memory);
  console.log(`[Memory] News feedback saved for ${companyId}: ${relevant ? 'RELEVANT' : 'IRRELEVANT'} — "${article.title}"`);
  return memory;
}

export function getNewsFeedbackCount(companyId) {
  const memory = loadNewsMemory(companyId);
  return memory.liked.length + memory.disliked.length;
}

/**
 * Builds a memory context block for the LLM prompt.
 * Uses time-decay and explicit anti-fixation instructions.
 */
function buildNewsMemoryBlock(companyId) {
  const memory = loadNewsMemory(companyId);
  if (memory.liked.length === 0 && memory.disliked.length === 0) return '';

  const now = Date.now();
  const formatEntry = (e) => {
    const ageMs = now - new Date(e.timestamp).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const isStale = ageDays > MEMORY_DECAY_DAYS;
    const ageNote = isStale ? ` [${ageDays}d ago — lower weight]` : ` [${ageDays}d ago]`;
    const reasonNote = e.reason ? ` — User's reason: "${e.reason}"` : '';
    return `"${e.title}"${ageNote}${reasonNote}`;
  };

  let block = '\nUSER FEEDBACK MEMORY:';
  block += '\nThe user has provided feedback on past articles. Use this to understand their PREFERENCES, not as a blocklist.';

  if (memory.liked.length > 0) {
    block += `\n\nArticles the user found RELEVANT (${memory.liked.length} total):`;
    memory.liked.slice(-5).forEach(e => { block += `\n  ✓ ${formatEntry(e)}`; });
  }
  if (memory.disliked.length > 0) {
    block += `\n\nArticles the user found NOT RELEVANT (${memory.disliked.length} total):`;
    memory.disliked.slice(-5).forEach(e => { block += `\n  ✗ ${formatEntry(e)}`; });
  }

  block += '\n\nIMPORTANT — How to use this feedback:';
  block += '\n• Understand the PATTERN of what makes articles relevant vs irrelevant to this user.';
  block += '\n  Example: if they disliked "Iran Hormuz closure threatens energy markets" but liked';
  block += '\n  "China logistics firms scramble for alternatives," the lesson is they want articles';
  block += '\n  about DIRECT supply chain operational impact, not broad geopolitical/energy news.';
  block += '\n• Do NOT suppress articles just because individual words appear in disliked titles.';
  block += '\n  A disliked article about "energy markets" does NOT mean suppress all articles mentioning "energy."';
  block += '\n• Do NOT fixate only on topics from liked articles. Maintain DIVERSITY across threat types';
  block += '\n  (component, geographic, logistics, geopolitical, environmental).';
  block += '\n• Older feedback (marked [Xd ago — lower weight]) should carry less influence.';
  block += '\n• When in doubt about relevance, INCLUDE the article — false negatives are worse than false positives.';

  return block;
}

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
    // ── STEP 1: Generate multiple targeted search queries ──
    const queries = generateSearchQueries(company);
    console.log(`[Perception] Generated ${queries.length} search queries:`, queries);

    // ── STEP 2: Call GNews API in parallel for each query ──
    const GNEWS_KEY = 'd331a512f06717692b7047e153a7af96';
    const fetchPromises = queries.map(q => fetchGNewsQuery(q, GNEWS_KEY));
    const results = await Promise.allSettled(fetchPromises);

    // Collect all articles, TAG each with the query that found it
    let allArticles = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`[Perception] Query "${queries[i]}" → ${result.value.length} articles`);
        result.value.forEach(article => {
          allArticles.push({ ...article, _sourceQuery: queries[i] });
        });
      } else {
        console.log(`[Perception] Query "${queries[i]}" → 0 articles`);
      }
    });

    // ── STEP 3: Deduplicate by title similarity ──
    const seen = new Set();
    allArticles = allArticles.filter(a => {
      const key = (a.title || '').toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    console.log(`[Perception] ${allArticles.length} unique articles after dedup`);

    if (allArticles.length === 0) {
      return mockDisruptions;
    }

    // ── STEP 3b: Pre-filter — remove previously disliked articles from pool ──
    const memory = loadNewsMemory(company.id);
    const dislikedTitles = new Set(memory.disliked.map(e => (e.title || '').toLowerCase().substring(0, 50)));
    if (dislikedTitles.size > 0) {
      const beforeCount = allArticles.length;
      allArticles = allArticles.filter(a => {
        const key = (a.title || '').toLowerCase().substring(0, 50);
        return !dislikedTitles.has(key);
      });
      const removed = beforeCount - allArticles.length;
      if (removed > 0) {
        console.log(`[Memory] Pre-filtered ${removed} previously disliked article(s) from pool (${allArticles.length} remaining)`);
      }
    }

    // ── STEP 4: Build rich article summaries with source query tags ──
    const cappedArticles = allArticles.slice(0, 50); // Send all articles to LLM
    const articleSummaries = cappedArticles.map((a, i) =>
      `  ${i + 1}. [Query: "${a._sourceQuery}"] "${a.title}"\n     Summary: ${a.description || 'No description'}\n     Source: ${a.source?.name || 'Unknown'} | Published: ${a.publishedAt || 'Unknown'} | URL: ${a.url || 'N/A'}`
    ).join('\n');

    // Count articles per query for source diversity reporting
    const queryCounts = {};
    cappedArticles.forEach(a => { queryCounts[a._sourceQuery] = (queryCounts[a._sourceQuery] || 0) + 1; });
    const diversityNote = Object.entries(queryCounts).map(([q, c]) => `"${q}" (${c})`).join(', ');

    // ── STEP 5: Send combined pool to LLM for relevance filtering ──
    const chatPrompt = `
TASK: Filter Live News for Supply Chain Relevance

COMPANY CONTEXT:
- Company: ${company.name}
- Industry: ${company.industry}
- Region: ${company.region}
- Critical Component: ${company.critical_component}
- Sourcing Strategy: ${company.sourcing}
- Suppliers: ${(company._suppliers || []).map(s => `${s.name} (${s.country})`).join(', ') || 'N/A'}

PERCEPTION LAYER OUTPUT:
The following ${cappedArticles.length} articles were gathered from ${queries.length} parallel search queries.
Source diversity: ${diversityNote}
${buildNewsMemoryBlock(company.id)}

ARTICLES:
${articleSummaries}

INSTRUCTIONS:
1. These articles are your ONLY data source. Do NOT fabricate or hallucinate articles.
2. Evaluate EVERY article above for relevance to THIS SPECIFIC company's supply chain.
3. Prioritize articles about: supply chain disruptions, component shortages, shipping delays,
   tariffs/sanctions, geopolitical events, natural disasters, trade route disruptions,
   factory incidents, or regulatory changes that could directly impact this company.
4. If USER FEEDBACK MEMORY is provided above, use it to learn the user's preferences:
   - Prioritize articles similar in topic/type to ones marked RELEVANT
   - Avoid selecting articles similar to ones marked IRRELEVANT
5. For EACH selected article, write a 1-2 sentence "description" explaining exactly HOW
   it threatens this company's supply chain (be specific to this company, not generic).
6. Select the TOP 3-5 most relevant and actionable articles. Return fewer if fewer are relevant.
7. If NONE are truly relevant, return an empty array.

OUTPUT FORMAT (strict JSON, no markdown, no extra text):
{"top_articles": [{"title": "exact title from above", "description": "company-specific impact summary", "publishedAt": "ISO date from above", "severity": "critical|high|medium"}]}
    `.trim();

    console.log(`[Perception] Sending ${cappedArticles.length} articles to LLM for filtering (from ${queries.length} queries)`);

    const res = await fetch('http://localhost:5670/webhook/get-live-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput: chatPrompt,
        companyId: company.id,
        industry: company.industry,
        region: company.region,
        critical_component: company.critical_component
      })
    });

    if (!res.ok) throw new Error(`Failed to fetch live news from agent: ${res.statusText}`);
    const rawData = await res.text();
    console.log('=== RAW NEWS RESPONSE ===', rawData);
    let data;
    try {
      let textToParse = rawData;
      try {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
          textToParse = parsed[0].text;
        } else if (parsed.text) {
          textToParse = parsed.text;
        } else if (parsed.top_articles || parsed.articles) {
          data = parsed;
        }
      } catch (_) {}

      if (!data) {
        let cleanText = textToParse.replace(/^```json\s*/mi, '').replace(/```\s*$/mi, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : cleanText;
        data = JSON.parse(jsonString);
      }
    } catch (e) {
      console.warn("Could not parse Agent news response as JSON:", rawData);
      data = { articles: [{ title: rawData, description: "Agent responded with plain text.", publishedAt: new Date().toISOString() }] };
    }

    const articles = data.top_articles || data.articles || (Array.isArray(data) ? data : []);

    // ── Post-filter safety net: remove any disliked articles that slipped through ──
    const postMemory = loadNewsMemory(company.id);
    const postDislikedTitles = new Set(postMemory.disliked.map(e => (e.title || '').toLowerCase().substring(0, 40)));
    const filteredArticles = postDislikedTitles.size > 0
      ? articles.filter(a => {
          const key = (a.title || '').toLowerCase().substring(0, 40);
          const blocked = postDislikedTitles.has(key);
          if (blocked) console.log(`[Memory] Post-filtered disliked article: "${a.title}"`);
          return !blocked;
        })
      : articles;

    if (filteredArticles && filteredArticles.length > 0) {
      const liveDisruptions = filteredArticles.map((article, idx) => {
        // Use LLM-assigned severity if available, otherwise estimate from content
        const llmSeverity = (article.severity || '').toLowerCase();
        const severity = ['critical', 'high', 'medium', 'low'].includes(llmSeverity)
          ? llmSeverity
          : estimateSeverity(article.title, article.description);

        // Estimate transit impact from article content keywords
        const transitDays = estimateTransitDays(article.title, article.description, severity);

        return {
          id: `live_${companyId}_${idx}`,
          type: categorizeDisruptionType(article.title, article.description),
          title: (article.title || '').substring(0, 80) + ((article.title || '').length > 80 ? '…' : ''),
          severity,
          region: company.region || 'Global',
          timestamp: article.publishedAt || new Date().toISOString(),
          details: article.description || article.content || 'Live news article.',
          delta_transit_days: transitDays,
          icon: 'truck'
        };
      });

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
 * Estimates severity from article text when LLM doesn't provide it
 */
function estimateSeverity(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const criticalKeywords = ['shutdown', 'halt', 'embargo', 'sanction', 'ban', 'catastroph', 'crisis', 'collapse', 'war', 'blockade'];
  const highKeywords = ['shortage', 'delay', 'tariff', 'strike', 'disruption', 'surge', 'suspend', 'restrict', 'flood', 'earthquake'];
  if (criticalKeywords.some(k => text.includes(k))) return 'critical';
  if (highKeywords.some(k => text.includes(k))) return 'high';
  return 'medium';
}

/**
 * Estimates transit delay days from article content and severity
 */
function estimateTransitDays(title, description, severity) {
  const text = `${title} ${description}`.toLowerCase();
  // Try to extract explicit day/week mentions
  const dayMatch = text.match(/(\d+)\s*(?:day|days)/);
  if (dayMatch) return Math.min(30, parseInt(dayMatch[1]));
  const weekMatch = text.match(/(\d+)\s*(?:week|weeks)/);
  if (weekMatch) return Math.min(30, parseInt(weekMatch[1]) * 7);
  // Fall back to severity-based estimate
  const severityDays = { critical: 14, high: 7, medium: 4, low: 2 };
  return severityDays[severity] || 5;
}

/**
 * Categorizes the disruption type from article content
 */
function categorizeDisruptionType(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (/port|shipping|freight|vessel|container|canal/.test(text)) return 'port_congestion';
  if (/tariff|sanction|embargo|trade war|geopolit|regulation/.test(text)) return 'geopolitical';
  if (/supplier|factory|manufactur|plant|production/.test(text)) return 'supplier_disruption';
  if (/storm|flood|hurricane|earthquake|typhoon|wildfire|climate|weather/.test(text)) return 'weather';
  return 'logistics';
}

// ============================================================
// LAYERED KEYWORD STRATEGY
// Each layer captures a different type of supply chain risk.
// Queries use GNews Boolean syntax (AND/OR) for precision.
// ============================================================

/**
 * Country code → full name (for human-readable queries)
 */
const COUNTRY_NAMES = {
  CN: 'China', MY: 'Malaysia', US: 'United States', CA: 'Canada',
  VN: 'Vietnam', MX: 'Mexico', TW: 'Taiwan', KR: 'South Korea',
  JP: 'Japan', TH: 'Thailand', ID: 'Indonesia', IN: 'India',
  DE: 'Germany', GB: 'United Kingdom', BR: 'Brazil',
};

/**
 * Industry-specific keyword configs
 * Maps industry types to component terms, risk keywords, and trade corridors
 */
const INDUSTRY_KEYWORDS = {
  electronics: {
    componentTerms: ['semiconductor', 'microcontroller', 'chip', 'PCB', 'capacitor', 'resistor', 'IC', 'wafer'],
    disruptionTerms: ['shortage', 'lead time', 'allocation', 'fabrication delay', 'supply disruption'],
    corridors: ['Strait of Malacca', 'South China Sea', 'Taiwan Strait', 'Suez Canal'],
    macroTerms: ['export controls chips', 'semiconductor trade war', 'CHIPS Act'],
  },
  automotive: {
    componentTerms: ['steel', 'fastener', 'wiring harness', 'sensor', 'stamped parts', 'molded plastic'],
    disruptionTerms: ['shortage', 'production halt', 'factory shutdown', 'recall', 'supply disruption'],
    corridors: ['US Mexico border', 'USMCA', 'Great Lakes shipping', 'Gulf of Mexico'],
    macroTerms: ['auto tariff', 'automotive trade', 'steel tariff', 'EV supply chain'],
  },
  food: {
    componentTerms: ['produce', 'dairy', 'leafy greens', 'fresh food', 'perishable', 'cold chain'],
    disruptionTerms: ['contamination', 'recall', 'crop failure', 'shortage', 'price surge'],
    corridors: ['US Canada border', 'California agriculture', 'Mexico produce', 'cold chain logistics'],
    macroTerms: ['food safety regulation', 'agricultural tariff', 'drought crop', 'food inflation'],
  },
};

/**
 * Detects which industry keyword config to use
 */
function getIndustryConfig(company) {
  const industry = (company.industry || '').toLowerCase();
  if (/electronic|iot|semiconductor|chip/.test(industry)) return INDUSTRY_KEYWORDS.electronics;
  if (/auto|vehicle|jit|motor/.test(industry)) return INDUSTRY_KEYWORDS.automotive;
  if (/food|fresh|perishable|agri/.test(industry)) return INDUSTRY_KEYWORDS.food;
  // Default: build a minimal config from company data
  return {
    componentTerms: [company.critical_component?.split(/[\s(]/)[0]?.toLowerCase() || 'parts'],
    disruptionTerms: ['shortage', 'disruption', 'delay'],
    corridors: [],
    macroTerms: ['supply chain disruption', 'trade tariff'],
  };
}

/**
 * Generates 6-10 targeted search queries using a 5-layer keyword strategy.
 * Each layer captures a different type of supply chain risk signal.
 */
function generateSearchQueries(company) {
  const config = getIndustryConfig(company);
  const suppliers = company._suppliers || [];
  const parts = (company._parts || []).filter(p => p.is_line_stop === 'True');
  const supplierCountries = [...new Set(suppliers.map(s => s.country).filter(Boolean))];
  const countryNames = supplierCountries.map(c => COUNTRY_NAMES[c] || c).filter(Boolean);

  const queries = [];

  // ── LAYER 1: Component & Product Layer ──
  // Target specific BOM items with disruption terms
  const criticalDescriptions = parts.slice(0, 3).map(p =>
    p.description.replace(/[()]/g, '').split(/\s+/)[0].toLowerCase()
  );
  const uniqueComponents = [...new Set([...criticalDescriptions, ...config.componentTerms.slice(0, 2)])];

  // Boolean query: component AND (shortage OR delay OR disruption)
  if (uniqueComponents.length > 0) {
    const componentOR = uniqueComponents.slice(0, 3).join(' OR ');
    queries.push(`(${componentOR}) AND (shortage OR delay OR disruption)`);
  }

  // ── LAYER 2: Geographic Risk Layer ──
  // Pair supplier countries with disruption terms
  if (countryNames.length > 0) {
    // Primary supplier country query
    const primaryCountry = countryNames[0];
    const industryWord = config.componentTerms[0] || 'manufacturing';
    queries.push(`${primaryCountry} AND (${industryWord} OR factory OR export)`);

    // Secondary supplier countries if different
    if (countryNames.length > 1) {
      const otherCountries = countryNames.slice(1, 3).join(' OR ');
      queries.push(`(${otherCountries}) AND (factory OR production OR shutdown)`);
    }
  }

  // ── LAYER 3: Trade Corridor & Logistics Layer ──
  // Target shipping routes and logistics disruptions
  if (config.corridors.length > 0) {
    const corridorQuery = config.corridors.slice(0, 2).join(' OR ');
    queries.push(`(${corridorQuery}) AND (disruption OR delay OR congestion)`);
  }
  // General logistics query
  queries.push('freight rate OR container shortage OR port congestion OR shipping delay');

  // ── LAYER 4: Geopolitical & Macro Layer ──
  // Broad systemic risk signals
  if (config.macroTerms.length > 0) {
    queries.push(config.macroTerms.slice(0, 2).join(' OR '));
  }
  // Tariff/trade query specific to supplier countries
  if (countryNames.length > 0) {
    const mainCountry = countryNames[0];
    queries.push(`${mainCountry} tariff OR sanctions OR trade war`);
  }

  // ── LAYER 5: Environmental & Force Majeure Layer ──
  // Natural disasters in supplier regions
  if (countryNames.length > 0) {
    const geoRegions = countryNames.slice(0, 2).join(' OR ');
    queries.push(`(${geoRegions}) AND (earthquake OR typhoon OR flood OR fire OR factory)`);
  }

  // Deduplicate and cap queries (GNews free tier: 100 req/day)
  const uniqueQueries = [...new Set(queries)];
  const capped = uniqueQueries.slice(0, 8);
  console.log(`[Perception] Layered strategy generated ${capped.length} queries across 5 layers`);
  return capped;
}

/**
 * Fetches articles from GNews API for a single query
 */
async function fetchGNewsQuery(query, apiKey) {
  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&apikey=${apiKey}&lang=en&max=8&sortby=publishedAt`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[GNews] Query "${query}" failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.articles || [];
  } catch (err) {
    console.warn(`[GNews] Query "${query}" error:`, err.message);
    return [];
  }
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

    // Look up disruption from mock data OR live news cache
    let disruption = (disruptionsData[companyId] || []).find(d => d.id === disruptionId);
    if (!disruption && liveNewsCache[companyId]?.data) {
      disruption = liveNewsCache[companyId].data.find(d => d.id === disruptionId);
    }
    if (!disruption) {
      console.warn(`Disruption ${disruptionId} not found in mock or live data. Using defaults.`);
      disruption = { id: disruptionId, title: 'Unknown Disruption', type: 'logistics', severity: 'medium', delta_transit_days: 5, details: '' };
    }

    // 0. Run simulation engine to compute ground truth metrics
    const simulation = simulateImpact(company, disruption);
    console.log('=== SIMULATION ENGINE OUTPUT ===', simulation);

    // 0.5 Retrieve Perception Layer output (cached news articles)
    const cachedNews = liveNewsCache[companyId]?.data || [];
    const perceptionArticles = cachedNews.map(d => ({
      title: d.title,
      details: d.details,
      region: d.region,
      severity: d.severity,
      publishedAt: d.timestamp,
    }));
    console.log(`=== PERCEPTION LAYER: ${perceptionArticles.length} articles piped to reasoning ===`);

    // 1. Build the prompt with strict JSON instructions + simulation + perception data
    const chatInput = buildPrompt(company, disruption, simulation, perceptionArticles);

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
      // Strip markdown codeblocks (```json and ```) if present
      let cleanText = agentRawText.replace(/^```json/mi, '').replace(/```$/mi, '').trim();

      // Attempt to find the outermost JSON object if there's still extra text
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanText;

      const parsedData = JSON.parse(jsonString);

      console.log('=== PARSED AGENT JSON ===');
      console.log('Keys:', Object.keys(parsedData));
      console.log(parsedData);

      // Apply validation layer
      const validatedData = validateRiskOutput(parsedData, company, simulation);

      // Generate dynamic reasoning trace instead of using mock
      const dynamicTrace = [
        { step: 1, agent: 'Perception', action: 'Parsed disruption signal', detail: `${disruption.type.toUpperCase()}: ${disruption.title.replace('(MOCK) ', '')}` },
        { step: 2, agent: 'Perception', action: 'Loaded company profile', detail: `${company.name}: ${company.sourcing} sourcing, ${company.inventory_buffer} buffer (${company.lead_time_days}d lead time)` },
        { step: 3, agent: 'Simulation', action: 'Queried inventory & financials', detail: `Daily revenue: $${simulation._simulation_inputs.daily_revenue.toLocaleString()}, Buffer: ${simulation._simulation_inputs.buffer_days} days` },
        { step: 4, agent: 'Simulation', action: 'Computed risk metrics', detail: `Stockout: ${Math.round(simulation.stockout_probability * 100)}%, SLA Risk: ${(simulation.sla_risk * 100).toFixed(1)}%, Rev at Risk: $${simulation.revenue_at_risk.toLocaleString()}` },
        { step: 5, agent: 'Reasoning', action: 'Evaluated mitigation options', detail: `Analyzed ${validatedData.mitigation_options?.length || 3} strategies for cost, service, and resilience` },
        { step: 6, agent: 'Reasoning', action: 'Selected optimal strategy', detail: `Recommended: ${(validatedData.mitigation_options?.find(o => o.recommended) || validatedData.mitigation_options?.[0] || {}).option || 'Best option'}` },
        { step: 7, agent: 'Planning', action: 'Drafted action artifacts', detail: Object.keys(validatedData.actions || {}).map(k => k.replace(/_/g, ' ')).join(', ') || 'Email, PO, Escalation' }
      ];

      const finalResponse = {
        ...mockResponse,
        ...validatedData,
        // Simulation-computed values are AUTHORITATIVE — override both mock and LLM
        sla_risk: simulation.sla_risk,
        stockout_probability: simulation.stockout_probability,
        risk_score: validatedData.risk_score ?? simulation.risk_score,
        reasoning_trace: dynamicTrace,
        _simulation: simulation,
        _live: true,
        _debug: 'Parsed JSON successfully'
      };
      console.log('=== FINAL MERGED RESPONSE (validated) ===');
      console.log(finalResponse);
      return finalResponse;
    } catch (parseError) {
      console.warn('Could not parse agent response as JSON, falling back to text-only update.');
      console.log('Parse error:', parseError.message);
      
      const fallbackTrace = [
        { step: 1, agent: 'Perception', action: 'Parsed disruption signal', detail: `${disruption.title}` },
        { step: 2, agent: 'Perception', action: 'Loaded company profile', detail: `${company.name}` },
        { step: 3, agent: 'Simulation', action: 'Ran simulated impact', detail: `Computed baseline risk metrics` },
        { step: 4, agent: 'Reasoning', action: 'Analysis Fallback', detail: `LLM returned unstructured text. Using fallback UI.` }
      ];

      return {
        ...mockResponse,
        explanation: agentRawText,
        reasoning_trace: fallbackTrace,
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

// ============================================================
// SIMULATION ENGINE — Computes risk metrics from real data
// ============================================================

/**
 * Maps qualitative buffer labels to actual days of safety stock.
 * Based on percentage of lead time:
 *   Low    = 10% of lead time (lean/JIT)
 *   Medium = 30% of lead time
 *   High   = 60% of lead time
 */
function bufferLabelToDays(label, leadTimeDays) {
  const map = {
    'low':    0.10,
    'medium': 0.30,
    'high':   0.60,
  };
  const fraction = map[(label || '').toLowerCase()] ?? 0.30;
  return Math.round(leadTimeDays * fraction);
}

function simulateImpact(company, disruption) {
  const annualRevenue = company.revenue_annual || 38_000_000;
  const dailyRevenue = annualRevenue / 365;
  const disruptionDays = disruption.delta_transit_days || 5;
  const leadTimeDays = company.lead_time_days || 30;
  const bufferDays = bufferLabelToDays(company.inventory_buffer, leadTimeDays);
  const isSingleSource = (company.sourcing || '').toLowerCase().includes('single');

  const severityMap = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 };
  const severityMultiplier = severityMap[disruption.severity] || 0.5;

  // ── Revenue at Risk ──
  // = daily revenue × disruption days × severity factor
  const revenueAtRisk = Math.round(dailyRevenue * disruptionDays * severityMultiplier);

  // ── Stockout Probability ──
  // Models how likely we run out of stock before the disruption is resolved.
  // Formula: base = 1 - (buffer / (disruption_days + buffer))
  // This gives a gradual curve:
  //   buffer=20, disruption=5  → 1 - 20/25 = 0.20 (20%)
  //   buffer=20, disruption=20 → 1 - 20/40 = 0.50 (50%)
  //   buffer=7,  disruption=10 → 1 - 7/17  = 0.59 (59%)
  //   buffer=7,  disruption=20 → 1 - 7/27  = 0.74 (74%)
  // Then boost for severity and single-source suppliers.
  const baseStockout = 1 - (bufferDays / (disruptionDays + bufferDays + 1));
  const singleSourceBoost = isSingleSource ? 1.25 : 1.0;
  const stockoutProbability = Math.max(0, Math.min(1, 
    baseStockout * severityMultiplier * singleSourceBoost * 1.5
  ));

  // ── SLA Risk ──
  // How much of the committed lead time is consumed/exceeded by the disruption.
  // Uses a non-linear curve: small delays have proportional impact,
  // but as disruption approaches lead time, risk accelerates.
  // Formula: (disruption / lead_time)^0.8 so it rises faster than linear.
  const rawSlaRisk = Math.pow(disruptionDays / Math.max(leadTimeDays, 1), 0.8);
  const slaRisk = Math.min(1, rawSlaRisk * (0.7 + severityMultiplier * 0.3));

  // ── Risk Score (0–100) ──
  // Weighted composite that produces meaningfully varied scores:
  //   Stockout impact:    35 points max
  //   SLA impact:         25 points max
  //   Severity baseline:  20 points max (critical=20, high=14, medium=8, low=4)
  //   Single-source risk: 10 points max
  //   Revenue proportion: 10 points max (how big is revenue-at-risk vs total?)
  const stockoutScore = stockoutProbability * 35;
  const slaScore = slaRisk * 25;
  const severityScore = severityMultiplier * 20;
  const singleSourceScore = isSingleSource ? 10 : 0;
  const revenueProportion = Math.min(1, revenueAtRisk / (annualRevenue * 0.05));
  const revenueScore = revenueProportion * 10;

  const riskScore = Math.round(Math.min(100, 
    stockoutScore + slaScore + severityScore + singleSourceScore + revenueScore
  ));

  // ── Orders Affected ──
  const avgOrderValue = 25000;
  const ordersAffected = Math.max(1, Math.round(revenueAtRisk / avgOrderValue));

  return {
    risk_score: riskScore,
    revenue_at_risk: revenueAtRisk,
    orders_affected: ordersAffected,
    sla_risk: slaRisk,
    stockout_probability: stockoutProbability,
    _simulation_inputs: {
      daily_revenue: Math.round(dailyRevenue),
      disruption_days: disruptionDays,
      buffer_days: bufferDays,
      buffer_label: company.inventory_buffer || 'Medium',
      lead_time_days: leadTimeDays,
      severity_multiplier: severityMultiplier,
      is_single_source: isSingleSource,
    }
  };
}

// ============================================================
// VALIDATION LAYER — Enforces business rules on LLM output
// ============================================================
function validateRiskOutput(data, company, simulation) {
  const validated = { ...data };
  const overrides = [];

  // ── Auto-normalize common LLM scoring mistakes ──
  // sla_risk and stockout_probability should be 0.0-1.0, not 0-100
  if (validated.sla_risk > 1.0 && validated.sla_risk <= 100) {
    validated.sla_risk = validated.sla_risk / 100;
    overrides.push('sla_risk auto-normalized from percentage to decimal');
  }
  if (validated.stockout_probability > 1.0 && validated.stockout_probability <= 100) {
    validated.stockout_probability = validated.stockout_probability / 100;
    overrides.push('stockout_probability auto-normalized from percentage to decimal');
  }
  // risk_score should be 0-100, not 0.0-1.0
  if (validated.risk_score > 0 && validated.risk_score <= 1.0) {
    validated.risk_score = Math.round(validated.risk_score * 100);
    overrides.push('risk_score auto-normalized from decimal to integer');
  }

  // ── Normalize mitigation option scores to 1.0-10.0 scale ──
  const mitigationOpts = validated.mitigation_options || [];
  mitigationOpts.forEach(opt => {
    if (opt.final_score > 10) {
      opt.final_score = Math.min(10, opt.final_score / 10);
      overrides.push(`final_score auto-normalized for "${opt.option}"`);
    }
    if (opt.service > 10) { opt.service = Math.min(10, opt.service / 10); }
    if (opt.resilience > 10) { opt.resilience = Math.min(10, opt.resilience / 10); }
  });

  if (validated.risk_score > 100) { validated.risk_score = 100; overrides.push('risk_score capped at 100'); }
  if (validated.risk_score < 0) { validated.risk_score = 0; overrides.push('risk_score floored at 0'); }
  if (validated.sla_risk > 1.0) { validated.sla_risk = 1.0; overrides.push('sla_risk capped at 1.0'); }
  if (validated.stockout_probability > 1.0) { validated.stockout_probability = 1.0; overrides.push('stockout_probability capped at 1.0'); }

  if (validated.revenue_at_risk > 500000 && validated.risk_score < 50) {
    validated.risk_score = Math.max(validated.risk_score, 75);
    overrides.push('risk_score elevated: revenue_at_risk > $500k');
  }

  if (company.sourcing === 'Single-Source' && validated.actions?.escalation) {
    validated.actions.escalation.priority = 'high';
    overrides.push('escalation set to high: single-source supplier');
  }

  if (simulation) {
    if (validated.revenue_at_risk > simulation.revenue_at_risk * 3) {
      validated.revenue_at_risk = simulation.revenue_at_risk * 3;
      overrides.push('revenue_at_risk capped at 3x simulation');
    }
    if (validated.revenue_at_risk < simulation.revenue_at_risk * 0.2) {
      validated.revenue_at_risk = Math.round(simulation.revenue_at_risk * 0.5);
      overrides.push('revenue_at_risk floored to 50% simulation');
    }
  }

  // ── Validate and fix cost_avoidance for mitigation options ──
  // The LLM often hallucinates cost_avoidance as (revenue_at_risk - cost),
  // which is wrong — a $0 option doesn't save $800K.
  // Correct approach: cost_avoidance = (effectiveness% × revenue_at_risk) - cost
  const options = validated.mitigation_options || [];
  const baseRevAtRisk = simulation?.revenue_at_risk || validated.revenue_at_risk || 0;
  
  options.forEach(opt => {
    const cost = opt.cost || 0;
    const service = opt.service_score ?? opt.service ?? 5;
    const resilience = opt.resilience_score ?? opt.resilience ?? 5;
    
    // Estimate effectiveness from service + resilience scores (1-10 scale)
    // Higher scores = more effective at preventing revenue loss
    const effectiveness = Math.min(1, ((service + resilience) / 20) * 0.9); // max 90%
    const realisticSavings = Math.round(effectiveness * baseRevAtRisk) - cost;
    
    // Validate LLM's cost_avoidance against realistic ceiling
    if (opt.cost_avoidance != null) {
      // Sanity checks on LLM-provided value
      if (opt.cost_avoidance > baseRevAtRisk) {
        opt.cost_avoidance = Math.max(0, realisticSavings);
        overrides.push(`cost_avoidance capped for "${opt.option}" (was > revenue_at_risk)`);
      }
      if (cost === 0 && opt.cost_avoidance > 0) {
        // $0 cost can't magically save money — it's a "do nothing" option
        opt.cost_avoidance = 0;
        overrides.push(`cost_avoidance zeroed for "${opt.option}" ($0 cost = no active mitigation)`);
      }
      if (opt.cost_avoidance < 0) {
        opt.cost_avoidance = 0;
        overrides.push(`cost_avoidance floored at 0 for "${opt.option}"`);
      }
    } else {
      // No value from LLM — compute a realistic one
      opt.cost_avoidance = cost > 0 ? Math.max(0, realisticSavings) : 0;
      overrides.push(`computed cost_avoidance for "${opt.option}"`);
    }

    // Normalize field names for the UI (LLM may use service/resilience or service_score/resilience_score)
    if (opt.service != null && opt.service_score == null) { opt.service_score = opt.service; }
    if (opt.resilience != null && opt.resilience_score == null) { opt.resilience_score = opt.resilience; }
  });

  const recommendedCount = options.filter(o => o.recommended).length;
  if (recommendedCount === 0 && options.length > 0) {
    const best = options.reduce((a, b) => (b.final_score || 0) > (a.final_score || 0) ? b : a, options[0]);
    best.recommended = true;
    overrides.push('auto-selected recommended option');
  } else if (recommendedCount > 1) {
    let first = true;
    options.forEach(o => { if (o.recommended) { if (!first) o.recommended = false; first = false; } });
    overrides.push('reduced to 1 recommended option');
  }

  if (overrides.length > 0) {
    console.log('=== VALIDATION OVERRIDES ===', overrides);
    validated._validation_overrides = overrides;
  }
  return validated;
}

// ============================================================
// FEEDBACK MEMORY — localStorage persistence
// ============================================================
function loadFeedbackHistory(companyId) {
  try {
    const all = JSON.parse(localStorage.getItem('agent_feedback') || '{}');
    return all[companyId] || [];
  } catch { return []; }
}

/**
 * Prompt Engineering for the Master Agent
 */
function buildPrompt(company, disruption, simulation = null, perceptionArticles = []) {
  if (!company || !disruption) {
    return 'Analyze general supply chain risk.';
  }


  // Build PERCEPTION LAYER block — only the clicked disruption is PRIMARY
  let perceptionBlock = '';
  if (perceptionArticles.length > 0) {
    // Find which article matches the current disruption (by title similarity)
    const currentTitle = (disruption.title || '').replace(/^\(MOCK\)\s*/i, '').toLowerCase();
    const primaryArticles = [];
    const contextArticles = [];
    perceptionArticles.forEach(a => {
      const aTitle = (a.title || '').toLowerCase();
      if (aTitle === currentTitle || currentTitle.includes(aTitle.substring(0, 30)) || aTitle.includes(currentTitle.substring(0, 30))) {
        primaryArticles.push(a);
      } else {
        contextArticles.push(a);
      }
    });

    perceptionBlock = `
    ── PERCEPTION LAYER OUTPUT ──
    PRIMARY DISRUPTION BEING ANALYZED:
    Title: "${disruption.title}"
    Details: ${disruption.details || 'N/A'}
    Severity: ${disruption.severity} | Transit Impact: +${disruption.delta_transit_days || 0} days
    
    Focus your ENTIRE analysis on this specific disruption above. Do NOT analyze other articles.`;

    if (contextArticles.length > 0) {
      perceptionBlock += `
    
    SUPPORTING CONTEXT (${contextArticles.length} other signals — for background only, do NOT analyze these):
    ${contextArticles.slice(0, 2).map((a, i) => `    ${i + 1}. "${a.title}" (${a.severity})`).join('\n')}
    ── END PERCEPTION OUTPUT ──`;
    } else {
      perceptionBlock += `
    ── END PERCEPTION OUTPUT ──`;
    }
  }

  // Build simulation context block — AUTHORITATIVE values
  let simulationBlock = '';
  if (simulation) {
    simulationBlock = `
    ── SIMULATION ENGINE (authoritative ground truth from real data) ──
    These values are computed from actual company financials and inventory data.
    You MUST use these EXACT values for sla_risk and stockout_probability in your output:
    
    risk_score: ${simulation.risk_score}  (integer, 0-100 scale — you may adjust ±10 based on qualitative factors)
    revenue_at_risk: ${simulation.revenue_at_risk}  (USD — you may adjust ±30% based on tool findings)
    stockout_probability: ${simulation.stockout_probability}  (decimal 0.0-1.0 — USE THIS EXACT VALUE)
    sla_risk: ${simulation.sla_risk}  (decimal 0.0-1.0 — USE THIS EXACT VALUE)
    
    Computation inputs: daily_revenue=$${simulation._simulation_inputs.daily_revenue}, disruption_days=${simulation._simulation_inputs.disruption_days}, buffer_days=${simulation._simulation_inputs.buffer_days}, severity=${simulation._simulation_inputs.severity_multiplier}
    ── END SIMULATION ──`;
  }

  // Build feedback memory block
  const pastFeedback = loadFeedbackHistory(company.id);
  let feedbackBlock = '';
  if (pastFeedback.length > 0) {
    const recent = pastFeedback.slice(-3);
    feedbackBlock = `
    MEMORY — Past Feedback (${pastFeedback.length} total entries, showing last ${recent.length}):
    ${recent.map(f => `- ${f.timestamp}: ${f.helpful ? 'HELPFUL' : 'NOT HELPFUL'}${f.comment ? ' — ' + f.comment : ''}`).join('\n    ')}
    Use this feedback to improve your recommendations.`;
  }

  // Summarize suppliers at a high level — withhold details to force tool usage
  const supplierNames = (company._suppliers || []).map(s => s.name).join(', ');
  const partCount = (company._parts || []).filter(p => p.is_line_stop === 'True').length;

  return `
    TASK: Analyze Disruption & Generate Risk Report
    
    Company: ${company.name} (${company.industry})
    Region: ${company.region}
    Critical Component: ${company.critical_component}
    Lead Time: ${company.lead_time_days} days
    Sourcing Strategy: ${company.sourcing}
    Risk Tolerance: ${company.risk_tolerance}
    Inventory Buffer: ${company.inventory_buffer}
    
    Known Suppliers: ${supplierNames || 'Unknown — use tool to look up'}
    Critical Line-Stop Parts: ${partCount} parts identified (use tool for details)
    
    Disruption: ${disruption.title}
    Type: ${disruption.type}
    Severity: ${disruption.severity}
    Details: ${disruption.details || 'N/A'}
    Transit Impact: +${disruption.delta_transit_days || 0} days
    ${perceptionBlock}
    ${simulationBlock}
    ${feedbackBlock}

    CRITICAL INSTRUCTIONS:
    1. You have access to a Risk Intelligence Agent Tool. YOU MUST CALL THIS TOOL FIRST before generating your analysis.
       - Use it to retrieve: full supplier reliability scores (OTIF%), part lead times, alternative sourcing options, and any additional risk context.
       - DO NOT skip this step. If you do NOT call this tool, your analysis will be incomplete and rejected.
    2. After calling the tool, generate your JSON response following the EXACT schema below.

    REQUIRED JSON OUTPUT SCHEMA:
    {
      "risk_score": <integer 0-100, anchor to simulation value ±10>,
      "revenue_at_risk": <integer USD, anchor to simulation value ±30%>,
      "stockout_probability": <decimal 0.0-1.0, USE SIMULATION VALUE EXACTLY>,
      "sla_risk": <decimal 0.0-1.0, USE SIMULATION VALUE EXACTLY>,
      "orders_affected": <integer>,
      "explanation": "<2-3 sentence analysis summary>",
      "reasoning": {
        "revenue_impact_logic": "<explain how revenue_at_risk was derived>",
        "sla_risk_factors": "<explain SLA risk factors>",
        "stockout_probability_rationale": "<explain stockout probability>"
      },
      "bias_mitigation_statement": "<how you ensured objectivity>",
      "mitigation_options": [
        {
          "option": "<strategy name>",
          "cost": <integer USD>,
          "cost_avoidance": <integer USD, must be > 0>,
          "service": <decimal 1.0-10.0>,
          "resilience": <decimal 1.0-10.0>,
          "final_score": <decimal 1.0-10.0, weighted composite>,
          "recommended": <boolean, exactly ONE must be true>,
          "pros": ["<pro1>", "<pro2>"],
          "cons": ["<con1>", "<con2>"]
        }
      ],
      "actions": {
        "supplier_email": { "to": "<email>", "subject": "<subject>", "body": "<email body>" },
        "po_suggestion": { "type": "<order type>", "sku": "<sku>", "quantity": <int>, "estimated_cost": <int>, "carrier": "<carrier>", "estimated_arrival": "<date>" },
        "escalation": { "to": "<email>", "priority": "<high|medium|low>", "note": "<escalation note>" }
      }
    }

    SCORING RULES:
    - risk_score: integer 0-100. Use simulation value (${simulation?.risk_score || 'N/A'}) as anchor. Adjust ±10 max.
    - sla_risk / stockout_probability: MUST be decimal 0.0-1.0, NOT percentage. Copy simulation values exactly.
    - mitigation final_score: 1.0-10.0 scale. Higher = better. Use weighted: 0.4*service + 0.4*resilience + 0.2*(cost_efficiency).
    - cost_avoidance: the estimated revenue SAVED by implementing this mitigation, accounting for its effectiveness. NOT simply "revenue_at_risk minus cost". A cheap option with low service score saves LESS than an expensive option with high service score.
    - Generate EXACTLY 3 mitigation options. EXACTLY 1 must be recommended.
    - All 3 options MUST be ACTIONABLE strategies with cost > 0. Do NOT include "Status Quo", "Do Nothing", "Wait and See", or any passive $0-cost option.
    - Each option must have a different strategic approach (e.g., expedited shipping, alternative supplier, buffer stock increase).

    RESPONSE FORMAT:
    - Return ONLY a raw JSON object. No text before/after. No markdown. No commentary.
    - Do NOT introduce yourself or say "Here is your analysis".
  `.trim();
}

export async function submitFeedback(payload) {
  console.log('Feedback submitted:', payload);

  // Persist to localStorage for memory integration
  try {
    const all = JSON.parse(localStorage.getItem('agent_feedback') || '{}');
    const key = payload.company_id || 'unknown';
    if (!all[key]) all[key] = [];
    all[key].push({
      disruption_id: payload.disruption_id,
      helpful: payload.helpful,
      comment: payload.comment || '',
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('agent_feedback', JSON.stringify(all));
    console.log(`[Memory] Stored feedback for ${key}. Total entries: ${all[key].length}`);
  } catch (e) {
    console.warn('Failed to persist feedback:', e);
  }

  return { ok: true };
}

export function getFeedbackCount(companyId) {
  try {
    const all = JSON.parse(localStorage.getItem('agent_feedback') || '{}');
    return (all[companyId] || []).length;
  } catch { return 0; }
}

// ============================================================
// ACTION REGENERATION — Re-generates a single action draft
// using the user's improvement prompt via n8n/Gemini
// ============================================================

const ACTION_SCHEMA_HINTS = {
  supplier_email: '{"to": "<email>", "subject": "<subject>", "body": "<full email body>"}',
  po_suggestion: '{"type": "<order type>", "sku": "<sku>", "quantity": <int>, "estimated_cost": <int>, "carrier": "<carrier>", "estimated_arrival": "<date>"}',
  escalation: '{"to": "<email>", "priority": "<high|medium|low>", "note": "<escalation note>"}',
};

const ACTION_LABELS = {
  supplier_email: 'Supplier Email',
  po_suggestion: 'Purchase Order Suggestion',
  escalation: 'Escalation Notice',
};

/**
 * Regenerates a single action draft based on user feedback.
 * Sends the current action + improvement prompt to n8n/Gemini and returns the new action.
 */
export async function regenerateAction(companyId, disruptionId, actionKey, currentAction, userPrompt) {
  const company = companiesData.find(c => c.id === companyId);
  let disruption = (disruptionsData[companyId] || []).find(d => d.id === disruptionId);
  if (!disruption && liveNewsCache[companyId]?.data) {
    disruption = liveNewsCache[companyId].data.find(d => d.id === disruptionId);
  }
  if (!disruption) {
    disruption = { id: disruptionId, title: 'Unknown Disruption', type: 'logistics', severity: 'medium', details: '' };
  }

  const label = ACTION_LABELS[actionKey] || actionKey;
  const schema = ACTION_SCHEMA_HINTS[actionKey] || '{}';

  const chatInput = `
TASK: Regenerate a Single Action Draft

You previously generated a ${label} for a supply chain disruption response. The human reviewer has REJECTED it and provided the following improvement instructions.

COMPANY: ${company?.name || companyId} (${company?.industry || 'Unknown'})
DISRUPTION: ${disruption.title}
Details: ${disruption.details || 'N/A'}

CURRENT ${label.toUpperCase()} (REJECTED):
${JSON.stringify(currentAction, null, 2)}

USER'S IMPROVEMENT INSTRUCTIONS:
"${userPrompt}"

INSTRUCTIONS:
1. Generate a NEW, IMPROVED version of this ${label} that addresses the user's feedback.
2. Keep all the same structural fields but rewrite the content based on the user's instructions.
3. Maintain professionalism and accuracy.
4. Return ONLY the JSON object for this single action — no wrapping, no markdown, no commentary.

REQUIRED JSON SCHEMA:
${schema}

RESPONSE FORMAT:
- Return ONLY a raw JSON object. No text before/after. No markdown. No commentary.
  `.trim();

  if (MODE === 'mock') {
    // In mock mode, simulate a small change
    await new Promise(r => setTimeout(r, 1500));
    const mockRegenerated = { ...currentAction };
    if (actionKey === 'supplier_email') {
      mockRegenerated.body = `[Regenerated based on: "${userPrompt}"]\n\n${currentAction.body}`;
      mockRegenerated.subject = `${currentAction.subject} (Revised)`;
    } else if (actionKey === 'po_suggestion') {
      mockRegenerated.type = `${currentAction.type || 'Emergency'} (Revised)`;
    } else if (actionKey === 'escalation') {
      mockRegenerated.note = `[Revised per feedback: "${userPrompt}"]\n\n${currentAction.note}`;
    }
    return mockRegenerated;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput,
        companyId,
        disruptionId,
        actionKey,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`n8n returned ${res.status}`);

    const rawResponse = await res.text();
    console.log(`=== REGENERATION RAW RESPONSE (${actionKey}) ===`, rawResponse);

    // Parse JSON from response (handle n8n wrapper formats)
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
      // n8n may wrap in { output: "..." } or { text: "..." }
      const innerText = parsed.output || parsed.text || (typeof parsed === 'string' ? parsed : null);
      if (innerText && typeof innerText === 'string') {
        const clean = innerText.replace(/^```json\s*/mi, '').replace(/```\s*$/mi, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
      }
      // If parsed already has the right shape (to/subject/body etc.), use directly
    } catch (e) {
      // Try parsing the raw text directly
      const clean = rawResponse.replace(/^```json\s*/mi, '').replace(/```\s*$/mi, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
    }

    console.log(`=== REGENERATED ACTION (${actionKey}) ===`, parsed);
    return parsed;
  } catch (err) {
    console.error(`Regeneration failed for ${actionKey}:`, err.message);
    // Return a lightly modified version as fallback
    const fallback = { ...currentAction };
    if (actionKey === 'supplier_email') {
      fallback.body = `[Auto-revised based on your feedback: "${userPrompt}"]\n\n${currentAction.body}`;
    } else if (actionKey === 'escalation') {
      fallback.note = `[Auto-revised based on your feedback: "${userPrompt}"]\n\n${currentAction.note}`;
    }
    return fallback;
  }
}

/**
 * Regenerates ALL action drafts (email, PO, escalation) aligned to a user-selected mitigation plan.
 * Called when the operator picks a different plan from the TradeoffTable.
 */
export async function regenerateAllActions(companyId, disruptionId, selectedPlan, currentActions) {
  const company = companiesData.find(c => c.id === companyId);
  let disruption = (disruptionsData[companyId] || []).find(d => d.id === disruptionId);
  if (!disruption && liveNewsCache[companyId]?.data) {
    disruption = liveNewsCache[companyId].data.find(d => d.id === disruptionId);
  }
  if (!disruption) {
    disruption = { id: disruptionId, title: 'Unknown Disruption', type: 'logistics', severity: 'medium', details: '' };
  }

  const chatInput = `
TASK: Regenerate All Action Drafts for a Different Mitigation Plan

The operator has reviewed the supply chain disruption analysis and has chosen a DIFFERENT mitigation strategy than the one originally recommended. You must now regenerate ALL action drafts (supplier email, purchase order, and escalation notice) to align with the operator's chosen plan.

COMPANY: ${company?.name || companyId} (${company?.industry || 'Unknown'})
Region: ${company?.region || 'Unknown'}
Critical Component: ${company?.critical_component || 'Unknown'}

DISRUPTION: ${disruption.title}
Details: ${disruption.details || 'N/A'}
Severity: ${disruption.severity}

OPERATOR'S SELECTED MITIGATION PLAN:
Name: ${selectedPlan.option}
Cost: $${selectedPlan.cost}
Service Score: ${selectedPlan.service_score ?? selectedPlan.service ?? 'N/A'}/10
Resilience Score: ${selectedPlan.resilience_score ?? selectedPlan.resilience ?? 'N/A'}/10
Pros: ${(selectedPlan.pros || []).join(', ')}
Cons: ${(selectedPlan.cons || []).join(', ')}

PREVIOUS ACTION DRAFTS (for reference on format and contacts):
${JSON.stringify(currentActions, null, 2)}

INSTRUCTIONS:
1. Rewrite the supplier_email to reflect the SELECTED plan (not the previously recommended one). Reference the specific strategy, costs, and timeline.
2. Rewrite the po_suggestion to match the SELECTED plan's procurement approach, quantities, and costs.
3. Rewrite the escalation notice to reference the SELECTED plan and explain why the operator chose it.
4. Keep the same contacts (to fields) from the previous drafts.
5. Return ONLY the JSON object below — no wrapping, no markdown, no commentary.

REQUIRED JSON SCHEMA:
{
  "supplier_email": {"to": "<email>", "subject": "<subject>", "body": "<full email body>"},
  "po_suggestion": {"type": "<order type>", "sku": "<sku>", "quantity": <int>, "estimated_cost": <int>, "carrier": "<carrier>", "estimated_arrival": "<date>"},
  "escalation": {"to": "<email>", "priority": "<high|medium|low>", "note": "<escalation note>"}
}

RESPONSE FORMAT:
- Return ONLY a raw JSON object. No text before/after. No markdown. No commentary.
  `.trim();

  if (MODE === 'mock') {
    await new Promise(r => setTimeout(r, 2000));
    const mock = { ...currentActions };
    if (mock.supplier_email) {
      mock.supplier_email = {
        ...mock.supplier_email,
        subject: `Re: ${selectedPlan.option} — ${disruption.title}`,
        body: `Dear Supplier Team,\n\nFollowing our review of the current disruption "${disruption.title}", our team has decided to proceed with the "${selectedPlan.option}" mitigation strategy (estimated cost: $${selectedPlan.cost?.toLocaleString()}).\n\n${mock.supplier_email.body.split('\n').slice(1).join('\n')}`,
      };
    }
    if (mock.po_suggestion) {
      mock.po_suggestion = {
        ...mock.po_suggestion,
        type: selectedPlan.option,
        estimated_cost: selectedPlan.cost || mock.po_suggestion.estimated_cost,
      };
    }
    if (mock.escalation) {
      mock.escalation = {
        ...mock.escalation,
        note: `Operator has selected "${selectedPlan.option}" (Cost: $${selectedPlan.cost?.toLocaleString()}) over the AI-recommended option. ${mock.escalation.note}`,
      };
    }
    return mock;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatInput,
        companyId,
        disruptionId,
        selectedPlan: selectedPlan.option,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`n8n returned ${res.status}`);

    const rawResponse = await res.text();
    console.log('=== REGENERATE ALL ACTIONS RAW RESPONSE ===', rawResponse);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
      const innerText = parsed.output || parsed.text || (typeof parsed === 'string' ? parsed : null);
      if (innerText && typeof innerText === 'string') {
        const clean = innerText.replace(/^```json\s*/mi, '').replace(/```\s*$/mi, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
      }
    } catch (e) {
      const clean = rawResponse.replace(/^```json\s*/mi, '').replace(/```\s*$/mi, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
    }

    console.log('=== REGENERATED ALL ACTIONS ===', parsed);
    return parsed;
  } catch (err) {
    console.error('Regenerate all actions failed:', err.message);
    // Fallback: return modified current actions
    const fallback = { ...currentActions };
    if (fallback.supplier_email) {
      fallback.supplier_email = { ...fallback.supplier_email, subject: `[${selectedPlan.option}] ${fallback.supplier_email.subject}` };
    }
    return fallback;
  }
}