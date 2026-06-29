const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Room name is required'], trim: true, maxlength: 100 },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  // BUG FIX #5: owner field was missing — rooms couldn't be filtered by user
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tournament: {
    name: { type: String, default: '', trim: true },
    logo: { type: String, default: '' },
  },
  rules: {
    basePrice:    { type: Number, default: 0.5 },
    bidIncrement: { type: Number, default: 0.5 },
    timerSeconds: { type: Number, default: 30 },
    rtmCards:     { type: Number, default: 2 },
    maxPlayers:   { type: Number, default: 11 },
    bidBonusRules: [{
      minBid: Number, maxBid: Number,
      bonusPoints: Number, bidIncrement: Number, label: String,
    }],
  },
  status: {
    type: String,
    enum: ['setup', 'active', 'paused', 'completed'],
    default: 'setup',
  },
  scheduledAt: { type: Date, default: null }, // optional planned start time — drives "Upcoming Auctions"
  currentPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  currentBid:    { type: Number, default: 0 },
  currentBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  auctionLog: [{
    message: String,
    type: { type: String, enum: ['bid','sold','unsold','info','pause','resume','retain'], default: 'info' },
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);