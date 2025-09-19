import Constants from 'expo-constants';
import { localGreeting, localReply } from './localChat';
import { computeAISummary } from './summary';

export interface CloudChatResponse {
  text: string;
}

export interface CloudChatRequest {
  mode: 'greeting' | 'chat';
  language: 'de' | 'en' | 'pl';
  model?: string;
  summary?: Record<string, any>;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

// Direct OpenAI API integration using Emergent LLM Key
const getEmergentLLMKey = () => {
  // Try multiple ways to get the key
  return Constants.expoConfig?.extra?.EXPO_PUBLIC_EMERGENT_LLM_KEY || 
         Constants.manifest?.extra?.EXPO_PUBLIC_EMERGENT_LLM_KEY ||
         (typeof process !== 'undefined' ? (process as any).env?.EXPO_PUBLIC_EMERGENT_LLM_KEY : null) ||
         'sk-emergent-e34Af18EdBf12063f7'; // Fallback
};

function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const opts: RequestInit = { ...init, signal: controller.signal };
  return fetch(input as any, opts).finally(() => clearTimeout(id));
}

/**
 * Test if Direct LLM is reachable by doing a simple health check
 */
export async function testCloudConnection(): Promise<boolean> {
  const EMERGENT_LLM_KEY = getEmergentLLMKey();
  if (!EMERGENT_LLM_KEY) {
    console.warn('No Emergent LLM Key available');
    return false;
  }
  
  try {
    // Simple test request to OpenAI API
    const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${EMERGENT_LLM_KEY}`,
        'Content-Type': 'application/json',
      },
    }, 3000);
    return (response as any)?.ok === true;
  } catch (error) {
    console.warn('Direct LLM connection test failed:', error);
    return false;
  }
}

/**
 * Call OpenAI API directly using Emergent LLM Key
 */
export async function callCloudLLM(request: CloudChatRequest): Promise<string> {
  const EMERGENT_LLM_KEY = getEmergentLLMKey();
  if (!EMERGENT_LLM_KEY) {
    throw new Error('No Emergent LLM Key available');
  }

  try {
    const systemPrompt = request.language === 'de' 
      ? 'Du bist Gugi, ein freundlicher Gesundheitscoach. Antworte kurz und hilfsreich auf Deutsch.'
      : request.language === 'pl'
      ? 'Jesteś Gugi, przyjaznym trenerem zdrowia. Odpowiadaj krótko i pomocnie po polsku.'
      : 'You are Gugi, a friendly health coach. Respond briefly and helpfully in English.';

    const messages: Array<{ role: 'system'|'user'|'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    if (request.mode === 'greeting') {
      // Create greeting based on summary
      const summaryText = request.summary ? 
        `User data: ${JSON.stringify(request.summary, null, 2)}` : 
        'No user data available';
      
      messages.push({
        role: 'user',
        content: request.language === 'de' 
          ? `Begrüße mich freundlich als Gesundheitscoach. Hier sind meine Daten: ${summaryText}`
          : request.language === 'pl'
          ? `Przywitaj mnie przyjaźnie jako trener zdrowia. Oto moje dane: ${summaryText}`
          : `Greet me friendly as a health coach. Here's my data: ${summaryText}`
      });
    } else {
      // Add chat history and current message
      if (request.messages) {
        messages.push(...request.messages);
      }
    }

    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EMERGENT_LLM_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'gpt-4o-mini',
        messages,
        max_tokens: 280,
        temperature: 0.4,
      }),
    }, 8000);

    if (!(response as any)?.ok) {
      const errorText = await (response as any).text?.();
      throw new Error(`OpenAI API responded with status ${(response as any)?.status}: ${errorText}`);
    }

    const data = await (response as any).json();
    const content = data.choices?.[0]?.message?.content || '';
    
    if (!content.trim()) {
      throw new Error('Empty response from OpenAI API');
    }

    return content.trim();
  } catch (error) {
    console.warn('Direct LLM call failed:', error);
    throw error;
  }
}

/**
 * Hybrid greeting - tries Cloud LLM first, falls back to local
 */
export async function hybridGreeting(state: any): Promise<string> {
  try {
    // Test connection first
    const isConnected = await testCloudConnection();
    if (!isConnected) {
      throw new Error('Cloud LLM not reachable');
    }

    // Prepare summary for Cloud LLM
    const summary = computeAISummary(state);
    
    const request: CloudChatRequest = {
      mode: 'greeting',
      language: state.language || 'de',
      model: 'gpt-4o-mini',
      summary
    };

    const result = await callCloudLLM(request);
    if (result && result.trim()) {
      console.log('✅ Cloud LLM greeting successful');
      return result.trim();
    }
    
    throw new Error('Empty response from Cloud LLM');
  } catch (error) {
    console.log('🔄 Cloud LLM failed, falling back to local greeting:', error);
    return await localGreeting(state);
  }
}

/**
 * Hybrid reply - tries Cloud LLM first, falls back to local
 */
export async function hybridReply(state: any, userMessage: string): Promise<string> {
  try {
    // Test connection first
    const isConnected = await testCloudConnection();
    if (!isConnected) {
      throw new Error('Cloud LLM not reachable');
    }

    // Prepare summary for Cloud LLM
    const summary = computeAISummary(state);
    
    // Get recent chat history for context
    const recentChat = (state.chat || []).slice(-6).map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.text
    }));

    // Add current user message
    recentChat.push({ role: 'user', content: userMessage });

    const request: CloudChatRequest = {
      mode: 'chat',
      language: state.language || 'de',
      model: 'gpt-4o-mini',
      summary,
      messages: recentChat
    };

    const result = await callCloudLLM(request);
    if (result && result.trim()) {
      console.log('✅ Cloud LLM reply successful');
      return result.trim();
    }
    
    throw new Error('Empty response from Cloud LLM');
  } catch (error) {
    console.log('🔄 Cloud LLM failed, falling back to local reply:', error);
    return await localReply(state, userMessage);
  }
}

/**
 * Get current AI status for UI indication
 */
export async function getAIStatus(): Promise<'cloud' | 'local' | 'offline'> {
  try {
    const isConnected = await testCloudConnection();
    return isConnected ? 'cloud' : 'local';
  } catch (error) {
    return 'local';
  }
}