/**
 * lib/vapi/client.ts
 *
 * Vapi API client wrapper with automatic endpoint detection (plural/singular).
 * Includes retry logic for transient failures.
 */

import { Assistant, Tool } from './types';
import { logger } from '../logger';

const VAPI_BASE_URL = 'https://api.vapi.ai';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export class VapiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = 'VapiError';
  }
}

export class VapiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = VAPI_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Make a request with retry logic for transient failures
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRIES
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Don't retry client errors (4xx) except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Success or server error that we might retry
        if (response.ok || attempt === retries - 1) {
          return response;
        }

        // Retry on 5xx or 429
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        logger.warn(`[VapiClient] Request failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error: any) {
        lastError = error;
        if (attempt < retries - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          logger.warn(`[VapiClient] Network error (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Make authenticated request to Vapi API
   */
  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    logger.debug(`[VapiClient] ${options.method || 'GET'} ${endpoint}`);

    const response = await this.fetchWithRetry(url, {
      ...options,
      headers
    });

    let data: any;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = typeof data === 'string' ? data : (data.message || data.error || 'Vapi API error');
      logger.error(`[VapiClient] Error ${response.status}: ${errorMessage}`);
      throw new VapiError(errorMessage, response.status, data);
    }

    return data;
  }

  /**
   * Try both plural and singular endpoint variants
   */
  private async requestWithEndpointDetection(
    pluralPath: string,
    singularPath: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      return await this.request(pluralPath, options);
    } catch (error: any) {
      if (error.status === 404) {
        logger.debug(`[VapiClient] Plural endpoint not found, trying singular: ${singularPath}`);
        return await this.request(singularPath, options);
      }
      throw error;
    }
  }

  // ============ ASSISTANT METHODS ============

  /**
   * List all assistants
   */
  async listAssistants(): Promise<Assistant[]> {
    return this.requestWithEndpointDetection('/assistant', '/assistants');
  }

  /**
   * Get assistant by ID
   */
  async getAssistant(id: string): Promise<Assistant> {
    return this.request(`/assistant/${id}`);
  }

  /**
   * Create a new assistant
   */
  async createAssistant(assistant: Partial<Assistant>): Promise<Assistant> {
    return this.request('/assistant', {
      method: 'POST',
      body: JSON.stringify(assistant)
    });
  }

  /**
   * Update an existing assistant
   */
  async updateAssistant(id: string, assistant: Partial<Assistant>): Promise<Assistant> {
    return this.request(`/assistant/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(assistant)
    });
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(id: string): Promise<void> {
    return this.request(`/assistant/${id}`, {
      method: 'DELETE'
    });
  }

  // ============ TOOL METHODS ============

  /**
   * List all tools
   */
  async listTools(): Promise<Tool[]> {
    return this.requestWithEndpointDetection('/tool', '/tools');
  }

  /**
   * Get tool by ID
   */
  async getTool(id: string): Promise<Tool> {
    return this.request(`/tool/${id}`);
  }

  /**
   * Create a new tool
   */
  async createTool(tool: Partial<Tool>): Promise<Tool> {
    return this.request('/tool', {
      method: 'POST',
      body: JSON.stringify(tool)
    });
  }

  /**
   * Update an existing tool
   */
  async updateTool(id: string, tool: Partial<Tool>): Promise<Tool> {
    return this.request(`/tool/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(tool)
    });
  }

  /**
   * Delete a tool
   */
  async deleteTool(id: string): Promise<void> {
    return this.request(`/tool/${id}`, {
      method: 'DELETE'
    });
  }
}
