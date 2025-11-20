'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./db/mongoose');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tutorRoutes = require('./routes/tutors');
const questionRoutes = require('./routes/question');
const walletRoutes = require('./routes/wallet');
const subcriptionRoutes = require('./routes/subcsription');
const solutionRoutes = require('./routes/solution');
const bookingRoutes = require('./routes/booking');
const sessionRoutes = require('./routes/session');
const bankRoutes = require('./routes/bank');
// const createAdmin = require('./scripts/createAdmin');

const app = express();

// Security middleware
app.use(helmet());
// app.use(
//   cors({
//     origin: '*',
//     credentials: true,
//     exposedHeaders: ['Content-Type', 'Content-Length'],
//   })
// );

app.use(
  cors({
    origin: '*',
    exposedHeaders: ['Content-Type', 'Content-Length'],
  })
);

// ✅ Add this middleware for all responses
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
// app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
// app.use(express.json());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use(authRoutes);
app.use(userRoutes);
app.use(tutorRoutes);
app.use(questionRoutes);
app.use(walletRoutes);
app.use(subcriptionRoutes);
app.use(solutionRoutes);
app.use(bookingRoutes);
app.use(sessionRoutes);
app.use(bankRoutes);

const PORT = process.env.PORT || 3000;

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Connect to database
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    // createAdmin();
  });
});

module.exports = app;
