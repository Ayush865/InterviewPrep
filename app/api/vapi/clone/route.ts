/**
 * app/api/vapi/clone/route.ts
 *
 * Endpoint to clone template assistant and tool to user's Vapi account.
 * Implements idempotency, versioning, and resource management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { VapiClient } from '@/lib/vapi/client';
import { decrypt } from '@/lib/crypto';
import { getApiKey, saveClonedResources } from '@/lib/db';
import { sanitizeAssistant, sanitizeTool } from '@/lib/vapi/sanitize';
import { parseVersionFromName, compareVersions } from '@/lib/version';
import { logger } from '@/lib/logger';
import { Assistant, Tool } from '@/lib/vapi/types';
import * as fs from 'fs';
import * as path from 'path';

interface CloneRequest {
  userId: string;
}

interface CloneResponse {
  assistantId: string;
  toolId: string;
  actions: string[];
}

export async function POST(request: NextRequest) {
  const actions: string[] = [];

  try {
    const body: CloneRequest = await request.json();
    const { userId } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid userId', code: 'INVALID_USER_ID' },
        { status: 400 }
      );
    }

    logger.info(`[Clone] Starting clone process for user: ${userId}`);

    // Load encrypted API key
    const encryptedKey = await getApiKey(userId);
    if (!encryptedKey) {
      return NextResponse.json(
        { error: 'API key not found. Please link your Vapi account first.', code: 'API_KEY_NOT_FOUND' },
        { status: 404 }
      );
    }

    const apiKey = decrypt(encryptedKey);
    const vapiClient = new VapiClient(apiKey);

    // Load template files
    const dataDir = path.join(process.cwd(), 'data');
    const templateAssistant: Assistant = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'template-assistant.json'), 'utf-8')
    );
    const templateTool: Tool = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'template-tool.json'), 'utf-8')
    );

    logger.info(`[Clone] Loaded templates: assistant="${templateAssistant.name}", tool="${templateTool.name}"`);

    // Parse versions from template names
    const templateToolVersion = parseVersionFromName(templateTool.name ?? '');
    const templateAssistantVersion = parseVersionFromName(templateAssistant.name);

    logger.info(`[Clone] Template versions: tool=${templateToolVersion || 'none'}, assistant=${templateAssistantVersion || 'none'}`);

    // STEP 1: Clone/reuse tool
    const existingTools = await vapiClient.listTools();
    const toolBaseName = (templateTool.name ?? '').replace(/_v[\d.]+$/, '');

    const matchingTools = existingTools.filter(t => {
      const baseName = t.name?.replace(/_v[\d.]+$/, '');
      return baseName === toolBaseName;
    });

    let finalToolId: string;

    if (matchingTools.length > 0) {
      // Find highest version tool
      let highestTool = matchingTools[0];
      let highestVersion = parseVersionFromName(highestTool.name || '') || '0';

      for (const tool of matchingTools) {
        const version = parseVersionFromName(tool.name || '') || '0';
        if (compareVersions(version, highestVersion) > 0) {
          highestVersion = version;
          highestTool = tool;
        }
      }

      const comparison = compareVersions(
        templateToolVersion || '0',
        highestVersion
      );

      if (comparison > 0) {
        // Template is newer - create new version and delete old ones
        logger.info(`[Clone] Template tool v${templateToolVersion} is newer than user's v${highestVersion}. Creating new version.`);

        const sanitizedTool = sanitizeTool(templateTool);
        const newTool = await vapiClient.createTool(sanitizedTool);
        finalToolId = newTool.id!;
        actions.push(`created-tool:${finalToolId}`);

        // Delete older versions
        for (const oldTool of matchingTools) {
          try {
            await vapiClient.deleteTool(oldTool.id!);
            actions.push(`deleted-old-tool:${oldTool.id}`);
            logger.info(`[Clone] Deleted old tool: ${oldTool.id}`);
          } catch (error: any) {
            logger.error(`[Clone] Failed to delete old tool ${oldTool.id}:`, error);
            actions.push(`delete-failed-tool:${oldTool.id}`);
          }
        }
      } else if (comparison === 0) {
        // Same version - reuse
        finalToolId = highestTool.id!;
        actions.push(`reused-tool:${finalToolId}`);
        logger.info(`[Clone] Reusing existing tool v${highestVersion}: ${finalToolId}`);
      } else {
        // User has newer version - do not clone
        finalToolId = highestTool.id!;
        actions.push(`skipped-tool-newer-exists:${finalToolId}`);
        logger.info(`[Clone] User has newer tool v${highestVersion}. Skipping clone.`);
      }
    } else {
      // No existing tool - create new
      logger.info(`[Clone] No existing tool found. Creating new tool.`);
      const sanitizedTool = sanitizeTool(templateTool);
      const newTool = await vapiClient.createTool(sanitizedTool);
      finalToolId = newTool.id!;
      actions.push(`created-tool:${finalToolId}`);
    }

    // STEP 2: Clone/reuse assistant
    const existingAssistants = await vapiClient.listAssistants();
    const assistantBaseName = templateAssistant.name.replace(/_v[\d.]+$/, '');

    const matchingAssistants = existingAssistants.filter(a => {
      const baseName = a.name?.replace(/_v[\d.]+$/, '');
      return baseName === assistantBaseName;
    });

    let finalAssistantId: string;

    if (matchingAssistants.length > 0) {
      // Find highest version assistant
      let highestAssistant = matchingAssistants[0];
      let highestVersion = parseVersionFromName(highestAssistant.name || '') || '0';

      for (const assistant of matchingAssistants) {
        const version = parseVersionFromName(assistant.name || '') || '0';
        if (compareVersions(version, highestVersion) > 0) {
          highestVersion = version;
          highestAssistant = assistant;
        }
      }

      const comparison = compareVersions(
        templateAssistantVersion || '0',
        highestVersion
      );

      if (comparison > 0) {
        // Template is newer - create new version and delete old ones
        logger.info(`[Clone] Template assistant v${templateAssistantVersion} is newer than user's v${highestVersion}. Creating new version.`);

        const sanitizedAssistant = sanitizeAssistant(templateAssistant, [finalToolId]);
        const newAssistant = await vapiClient.createAssistant(sanitizedAssistant);
        finalAssistantId = newAssistant.id!;
        actions.push(`created-assistant:${finalAssistantId}`);

        // Delete older versions
        for (const oldAssistant of matchingAssistants) {
          try {
            await vapiClient.deleteAssistant(oldAssistant.id!);
            actions.push(`deleted-old-assistant:${oldAssistant.id}`);
            logger.info(`[Clone] Deleted old assistant: ${oldAssistant.id}`);
          } catch (error: any) {
            logger.error(`[Clone] Failed to delete old assistant ${oldAssistant.id}:`, error);
            actions.push(`delete-failed-assistant:${oldAssistant.id}`);
          }
        }
      } else if (comparison === 0) {
        // Same version - reuse (but update tool IDs if needed)
        finalAssistantId = highestAssistant.id!;
        actions.push(`reused-assistant:${finalAssistantId}`);
        logger.info(`[Clone] Reusing existing assistant v${highestVersion}: ${finalAssistantId}`);
      } else {
        // User has newer version - do not clone
        finalAssistantId = highestAssistant.id!;
        actions.push(`skipped-assistant-newer-exists:${finalAssistantId}`);
        logger.info(`[Clone] User has newer assistant v${highestVersion}. Skipping clone.`);
      }
    } else {
      // No existing assistant - create new
      logger.info(`[Clone] No existing assistant found. Creating new assistant.`);
      const sanitizedAssistant = sanitizeAssistant(templateAssistant, [finalToolId]);
      const newAssistant = await vapiClient.createAssistant(sanitizedAssistant);
      finalAssistantId = newAssistant.id!;
      actions.push(`created-assistant:${finalAssistantId}`);
    }

    // Save to database
    await saveClonedResources(userId, finalAssistantId, finalToolId);

    logger.info(`[Clone] Clone completed successfully for user ${userId}`);
    logger.info(`[Clone] Actions: ${JSON.stringify(actions)}`);

    const response: CloneResponse = {
      assistantId: finalAssistantId,
      toolId: finalToolId,
      actions
    };

    return NextResponse.json(response);

  } catch (error: any) {
    logger.error(`[Clone] Error during clone process:`, error);

    // Check for specific error types
    if (error.status === 403 || error.status === 401) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions. Please ensure your API key has create/delete permissions.',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: error.message
        },
        { status: 409 }
      );
    }

    if (error.status === 400) {
      return NextResponse.json(
        {
          error: 'Bad request to Vapi API',
          code: 'VAPI_BAD_REQUEST',
          details: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error during clone process',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        actions // Include actions taken before failure
      },
      { status: 500 }
    );
  }
}
