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
  token: process.env.SASP_AUTH_TOKEN || 'default-token-change-me',
  roomId: process.env.SASP_ROOM_ID || 'sasp-default-room',
  logLevel: (process.env.SASP_LOG_LEVEL as ServerConfig['logLevel']) || 'info',
};

export function loadConfig(): ServerConfig {
  return {
    ...defaultConfig,
    port: process.env.SASP_PORT ? parseInt(process.env.SASP_PORT, 10) : defaultConfig.port,
    wsPort: process.env.SASP_WS_PORT ? parseInt(process.env.SASP_WS_PORT, 10) : defaultConfig.wsPort,
  };
}
