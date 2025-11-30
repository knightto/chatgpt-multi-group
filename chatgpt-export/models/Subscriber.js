const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true
    },
    email: { type: String, required: true },
    name: { type: String },
    unsubscribeToken: { type: String, required: true }
  },
  { timestamps: true }
);

subscriberSchema.index({ groupId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Subscriber', subscriberSchema);
