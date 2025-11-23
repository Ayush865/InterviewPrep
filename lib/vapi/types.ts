/**
 * lib/vapi/types.ts
 *
 * TypeScript type definitions for Vapi API entities.
 */

export interface Assistant {
  id?: string;
  orgId?: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  model?: AssistantModel;
  voice?: AssistantVoice;
  firstMessage?: string;
  transcriber?: AssistantTranscriber;
  serverUrl?: string;
  serverUrlSecret?: string;
  analysisPlan?: any;
  artifactPlan?: any;
  messagePlan?: any;
  startSpeakingPlan?: any;
  stopSpeakingPlan?: any;
  monitorPlan?: any;
  credentialIds?: string[];
  backgroundSound?: string;
  backchannelingEnabled?: boolean;
  backgroundDenoisingEnabled?: boolean;
  modelOutputInMessagesEnabled?: boolean;
  transportConfigurations?: any[];
  clientMessages?: string[];
  serverMessages?: string[];
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
  responseDelaySeconds?: number;
  llmRequestDelaySeconds?: number;
  numWordsToInterruptAssistant?: number;
  metadata?: Record<string, any>;

  // Read-only fields (should be removed during sanitization)
  owner?: any;
  isServerUrlSecretSet?: boolean;
  phoneNumbers?: any[];
  billing?: any;
  lastModifiedBy?: string;
  _rev?: string;
  _id?: string;
}

export interface AssistantModel {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  emotionRecognitionEnabled?: boolean;
  toolIds?: string[];
  messages?: ModelMessage[];
  tools?: any[];
  knowledgeBase?: any;
  [key: string]: any;
}

export interface ModelMessage {
  role: string;
  content: string;
}

export interface AssistantVoice {
  provider: string;
  voiceId: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  useSpeakerBoost?: boolean;
  [key: string]: any;
}

export interface AssistantTranscriber {
  provider: string;
  model?: string;
  language?: string;
  keywords?: string[];
  [key: string]: any;
}

export interface Tool {
  id?: string;
  orgId?: string;
  createdAt?: string;
  updatedAt?: string;
  type: string;
  name?: string;
  description?: string;
  messages?: ToolMessage[];
  function?: ToolFunction;
  async?: boolean;
  server?: ToolServer;

  // Read-only fields
  _id?: string;
  _rev?: string;
  owner?: any;
  lastModifiedBy?: string;
}

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: ToolParameters;
  [key: string]: any;
}

export interface ToolParameters {
  type: string;
  properties: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

export interface ToolMessage {
  type: string;
  content?: string;
  conditions?: any[];
  [key: string]: any;
}

export interface ToolServer {
  url: string;
  secret?: string;
  timeoutSeconds?: number;
  [key: string]: any;
}

// Database types
export interface UserVapiKey {
  userId: string;
  encryptedApiKey: string;
  assistantId?: string;
  toolId?: string;
  createdAt: Date;
  updatedAt: Date;
}
