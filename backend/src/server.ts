import { createApp } from './app.js';
import { connectDatabase } from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`[Server] Pharmacy Management System running on http://localhost:${PORT}`);
    console.log(`[Server] Health check endpoint: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
