/**
 * Configuration for the SASP MCP server
 */

export interface ServerConfig {
  port: number;
  wsPort: number;
  token: string;
  roomId: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const defaultConfig: ServerConfig = {
  port: 3000,
  wsPort: 1234,
  token: (() => {
    const token = process.env.SASP_AUTH_TOKEN || 'default-token-change-me';
    if (token === 'default-token-change-me') {
      console.warn('[WARNING] Using default token. Set SASP_AUTH_TOKEN for production!');
    }
    return token;
  })(),
  roomId: process.env.SASP_ROOM_ID || 'sasp-default-room',
  logLevel: (() => {
    const level = process.env.SASP_LOG_LEVEL as ServerConfig['logLevel'];
    const validLevels: ServerConfig['logLevel'][] = ['debug', 'info', 'warn', 'error'];
    if (level && !validLevels.includes(level)) {
      console.warn(`[WARNING] Invalid SASP_LOG_LEVEL: ${level}. Using 'info'.`);
      return 'info';
    }
    return level || 'info';
  })(),
};

export function loadConfig(): ServerConfig {
  return {
    ...defaultConfig,
    port: process.env.SASP_PORT ? parseInt(process.env.SASP_PORT, 10) : defaultConfig.port,
    wsPort: process.env.SASP_WS_PORT ? parseInt(process.env.SASP_WS_PORT, 10) : defaultConfig.wsPort,
  };
}
