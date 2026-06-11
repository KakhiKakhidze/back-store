import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3377;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Import Routes (to be implemented)
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import inventoryRoutes from './routes/inventory.js';
import receivingRoutes from './routes/receiving.js';
import issuanceRoutes from './routes/issuance.js';
import purchasingRoutes from './routes/purchasing.js';
import poRoutes from './routes/po.js';
import reportsRoutes from './routes/reports.js';
import supplierRoutes from './routes/suppliers.js';
import stocktakeRoutes from './routes/stocktake.js';
import tenderRoutes from './routes/tender.js';
import alertsRoutes from './routes/alerts.js';
import specialOfferRoutes from './routes/specialOffers.js';
import supplierProductRoutes from './routes/supplierProducts.js';

// Route Middlewares
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/receiving', receivingRoutes);
app.use('/api/issuance', issuanceRoutes);
app.use('/api/purchasing', purchasingRoutes);
app.use('/api/po', poRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/stocktake', stocktakeRoutes);
app.use('/api/tender', tenderRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/special-offers', specialOfferRoutes);
app.use('/api/supplier-products', supplierProductRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
