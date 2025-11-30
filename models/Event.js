const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const teeTimeSchema = new mongoose.Schema(
  {
    time: { type: String, required: true }, // HH:MM
    players: [playerSchema],
    capacity: { type: Number, default: 4 }
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    players: [playerSchema],
    capacity: { type: Number, default: 4 }
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true
    },
    name: { type: String, required: true },
    description: String,
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ['teeTime', 'team'],
      default: 'teeTime'
    },
    teamSize: { type: Number, default: 4 }, // for team events
    startType: { type: String, default: 'straight' },
    teeTimes: [teeTimeSchema],
    teams: [teamSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
