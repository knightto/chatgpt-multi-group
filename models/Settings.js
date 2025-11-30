const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    globalNotificationsEnabled: { type: Boolean, default: true },
    dailyReminderHour: { type: Number, default: 17 } // 5pm
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
