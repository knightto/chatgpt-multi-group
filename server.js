require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const { startRemindersScheduler } = require('./utils/reminders');

const groupsRouter = require('./routes/groups');
const eventsRouter = require('./routes/events');
const subscribersRouter = require('./routes/subscribers');
const adminRouter = require('./routes/admin');

const app = express();

connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/groups', groupsRouter);
app.use('/api/groups/:groupId/events', (req, res, next) => {
  next();
}, eventsRouter);

app.use('/api/groups/:groupId/subscribers', (req, res, next) => {
  next();
}, subscribersRouter);

app.use('/api/admin', adminRouter);

// Unsubscribe redirect (simple)
const Subscriber = require('./models/Subscriber');
app.get('/unsubscribe/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).send('Invalid unsubscribe link.');

  const sub = await Subscriber.findOneAndDelete({ unsubscribeToken: token });
  if (!sub) return res.status(404).send('Subscription not found or already removed.');

  res.send('You have been unsubscribed successfully.');
});

// Root -> home.html explicitly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// 404 handler for API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Start scheduler
startRemindersScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(JSON.stringify({ t: new Date().toISOString(), level: 'info', msg: 'listening', port: PORT }));
});
