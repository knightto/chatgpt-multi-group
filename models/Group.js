const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    template: {
      type: String,
      enum: ['default', 'golf', 'social'],
      default: 'golf'
    },
    accessCode: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Group', groupSchema);
