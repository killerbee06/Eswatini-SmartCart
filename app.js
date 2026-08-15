import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';

import config from './config/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { recordLocation, TRACKING_EVENTS } from './services/tracking.service.js';
import { auditLogger } from './middleware/auditLog.js';
import { botProtection, sanitizeInput, sanitizeResponse, validateContentType, securityHeaders } from './middleware/security.js';

// Route modules
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import storeRoutes from './modules/stores/stores.routes.js';
import productRoutes from './modules/products/products.routes.js';
import categoryRoutes from './modules/products/categories.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import deliveryRoutes from './modules/delivery/delivery.routes.js';
import payoutRoutes from './modules/payouts/payouts.routes.js';
import adminReportRoutes from './modules/admin/admin.reports.routes.js';
import adminSettingsRoutes from './modules/admin/admin.settings.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import promotionRoutes from './modules/promotions/promotions.routes.js';
import loyaltyRoutes from './modules/loyalty/loyalty.routes.js';
import comboRoutes from './modules/combos/combos.routes.js';
import advertisementRoutes from './modules/advertisements/advertisements.routes.js';
import addressRoutes from './modules/delivery-addresses/delivery-addresses.routes.js';
import storeFavoritesRoutes from './modules/store-favorites/store-favorites.routes.js';
import storefrontService from './services/storefront.service.js';

const app = express();
const server = createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================
const io = new Server(server, {
  cors: {
    origin: config.cors.origins === '*' ? '*' : config.cors.origins.split(','),
    methods: ['GET', 'POST'],
  },
});

// Attach io to every request so controllers can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ============================================================
// SOCKET.IO AUTHENTICATION
// ============================================================
io.use(socketAuthMiddleware);

// Socket.IO connections (all connected sockets are authenticated)
io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`🔌 Client connected: ${socket.id} (${user.role} ${user.fullName})`);

  // ── Room management ────────────────────────────────────────

  // Join a merchant store room (for merchant notifications)
  socket.on('join_merchant_room', (storeName) => {
    if (storeName) {
      const room = `store_${storeName.toLowerCase().trim()}`;
      socket.join(room);
      console.log(`📍 Socket ${socket.id} joined merchant room: ${room}`);
    }
  });

  // Join delivery tracking room (customer or driver joins to receive updates)
  socket.on('join_delivery_room', (deliveryId) => {
    if (deliveryId) {
      const room = `delivery_${deliveryId}`;
      socket.join(room);
      console.log(`📦 Socket ${socket.id} joined delivery room: ${room}`);

      // Confirm room join
      socket.emit('room_joined', { room, deliveryId });
    }
  });

  // Join user notification room (for real-time notifications)
  socket.on('join_user_room', () => {
    const room = `user_${user.id}`;
    socket.join(room);
    console.log(`🔔 Socket ${socket.id} joined user room: ${room}`);
    socket.emit('room_joined', { room });
  });

  // Leave delivery tracking room
  socket.on('leave_delivery_room', (deliveryId) => {
    if (deliveryId) {
      const room = `delivery_${deliveryId}`;
      socket.leave(room);
      console.log(`📦 Socket ${socket.id} left delivery room: ${room}`);
    }
  });

  // ── Driver location updates (authenticated) ──────────────
  socket.on('driver_location_update', async (data) => {
    // Only drivers can send location updates
    if (user.role !== 'DRIVER' && user.role !== 'ADMIN') {
      socket.emit('error', { message: 'Only drivers can send location updates.' });
      return;
    }

    const { deliveryId, latitude, longitude, accuracy, speed, heading } = data;

    if (!deliveryId || latitude == null || longitude == null) {
      socket.emit('error', { message: 'deliveryId, latitude, and longitude are required.' });
      return;
    }

    try {
      await recordLocation({
        deliveryId,
        driverId: user.id,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy ? Number(accuracy) : null,
        speed: speed ? Number(speed) : null,
        heading: heading ? Number(heading) : null,
        io,
      });

      // Acknowledge receipt to the driver
      socket.emit('location_recorded', {
        deliveryId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Typing indicator (for in-app chat, future) ──────────
  socket.on('typing', (data) => {
    if (data.deliveryId) {
      socket.to(`delivery_${data.deliveryId}`).emit(TRACKING_EVENTS.DRIVER_TYPING, {
        userId: user.id,
        name: user.fullName,
        deliveryId: data.deliveryId,
      });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
  });
});

// ============================================================
// GLOBAL MIDDLEWARE
// ============================================================

// Security headers via Helmet (items 4, 18, 19)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
}));

// Force HTTPS in production (item 19)
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && !req.hostname.includes('localhost')) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// CORS
app.use(cors({
  origin: config.cors.origins === '*' ? true : config.cors.origins.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400, // Pre-flight cache 24h
}));

// Body parsing with size limits (item 16 — restrict large payloads)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request ID for tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Security: strip sensitive headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  next();
});

// Rate limiting (item 11)
app.use('/api/', apiLimiter);

// Bot protection (item 12)
app.use(botProtection);

// Input sanitization — XSS prevention (item 15)
app.use(sanitizeInput);

// Content-Type validation (item 14)
app.use(validateContentType);

// Additional security headers (item 18)
app.use(securityHeaders);

// Response sanitizer — strip sensitive fields (item 17)
app.use(sanitizeResponse);

// Audit logging (records mutations to audit_logs table)
app.use(auditLogger);

// Serve static frontend files
app.use(express.static('public'));

// ============================================================
// API v1 ROUTES
// ============================================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/deliveries', deliveryRoutes);
app.use('/api/v1/payouts', payoutRoutes);
app.use('/api/v1/admin/reports', adminReportRoutes);
app.use('/api/v1/admin/settings', adminSettingsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/promotions', promotionRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/combos', comboRoutes);
app.use('/api/v1/advertisements', advertisementRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/store-favorites', storeFavoritesRoutes);

// ── Storefront / Search endpoints ────────────────────────
app.get('/api/v1/search', async (req, res) => {
  try {
    const result = await storefrontService.searchProducts({
      query: req.query.q,
      category_id: req.query.category_id,
      store_id: req.query.store_id,
      selling_method: req.query.selling_method,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 20,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/storefront/:storeId', async (req, res) => {
  try {
    const store = await storefrontService.getStorefront(req.params.storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, data: store });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/v1/featured-stores', async (req, res) => {
  try {
    const stores = await storefrontService.getFeaturedStores(parseInt(req.query.limit, 10) || 6);
    res.json({ success: true, data: stores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// ERROR HANDLING (must be last)
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

export { app, server, io };
