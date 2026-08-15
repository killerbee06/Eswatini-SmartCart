/**
 * SmartCart Server Entry Point
 * Thin entry — all configuration lives in src/app.js
 */
import { server } from './src/app.js';
import config from './src/config/index.js';

server.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 SmartCart API running on http://localhost:${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔗 API base: http://localhost:${config.port}/api/v1`);
});
