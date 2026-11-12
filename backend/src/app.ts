import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import categoryRoutes from './routes/category.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import medicineRoutes from './routes/medicine.routes.js';
import batchRoutes from './routes/batch.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import movementRoutes from './routes/movement.routes.js';
import saleRoutes from './routes/sale.routes.js';
import returnRoutes from './routes/return.routes.js';
import adjustmentRoutes from './routes/adjustment.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

export const createApp = (): Express => {
  const app = express();

  // Security & Utility Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Base API routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/medicines', medicineRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/movements', movementRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/returns', returnRoutes);
  app.use('/api/adjustments', adjustmentRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
    });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
