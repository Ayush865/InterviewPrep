/**
 * lib/logger.ts
 *
 * Simple logging utility that writes to console and file.
 * Logs are written to logs/vapi-clone.log with timestamps.
 */

import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logFilePath: string;
  private logLevel: LogLevel;
  private isServerless: boolean;

  constructor() {
    // Detect if we're in a serverless environment
    this.isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY
    );

    const logsDir = path.join(process.cwd(), 'logs');
    this.logFilePath = path.join(logsDir, 'vapi-clone.log');
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

    // Only create logs directory in non-serverless environments
    if (!this.isServerless) {
      try {
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
      } catch (error) {
        // If we can't create the directory, assume serverless
        this.isServerless = true;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data !== undefined) {
      if (data instanceof Error) {
        formatted += `\n  Error: ${data.message}`;
        if (data.stack) {
          formatted += `\n  Stack: ${data.stack}`;
        }
      } else if (typeof data === 'object') {
        try {
          formatted += `\n  ${JSON.stringify(data, null, 2)}`;
        } catch {
          formatted += `\n  [Circular or non-serializable object]`;
        }
      } else {
        formatted += `\n  ${data}`;
      }
    }

    return formatted;
  }

  private writeToFile(message: string): void {
    // Skip file logging in serverless environments
    if (this.isServerless) {
      return;
    }

    try {
      fs.appendFileSync(this.logFilePath, message + '\n', 'utf8');
    } catch (error) {
      // If file logging fails, only log to console
      // Don't log the error itself to avoid recursion
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: any): void {
    // Skip all logging in serverless environments
    if (this.isServerless) {
      return;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, data);

    // Always write to file (except for sensitive data)
    if (!this.containsSensitiveData(message, data)) {
      this.writeToFile(formatted);
    }

    // Write to console
    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  /**
   * Check if message or data contains sensitive information
   * Prevents logging API keys, passwords, etc.
   */
  private containsSensitiveData(message: string, data?: any): boolean {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /bearer\s+[a-zA-Z0-9_-]+/i,
      /sk_[a-zA-Z0-9_-]+/i // Vapi key pattern
    ];

    // Check message
    for (const pattern of sensitivePatterns) {
      if (pattern.test(message)) {
        return true;
      }
    }

    // Check data
    if (data) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      for (const pattern of sensitivePatterns) {
        if (pattern.test(dataStr)) {
          return true;
        }
      }
    }

    return false;
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    const childLogger = new Logger();
    const originalLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, data?: any) => {
      originalLog(level, `${prefix} ${message}`, data);
    };

    return childLogger;
  }

  /**
   * Clear the log file
   */
  clearLogFile(): void {
    // Skip in serverless environments
    if (this.isServerless) {
      console.warn('clearLogFile() called in serverless environment - skipping');
      return;
    }

    try {
      fs.writeFileSync(this.logFilePath, '', 'utf8');
      this.info('Log file cleared');
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
