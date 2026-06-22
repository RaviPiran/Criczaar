const mongoose = require('mongoose');

const playerRequestSchema = new mongoose.Schema({
  room:         { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  name:         { type: String, required: true, trim: true },
  email:        { type: String, default: '', trim: true },
  phone:        { type: String, default: '', trim: true },
  club:         { type: String, default: '', trim: true },
  role:         { type: String, default: '', trim: true },
  battingStyle: { type: String, default: '' },
  bowlingStyle: { type: String, default: '' },
  photo:        { type: String, default: '' },
  status: {
    type:    String,
    enum:    ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedAt:   { type: Date,   default: null },
  rejectReason: { type: String, default: '' },
  playerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  source:       { type: String, default: 'self_registration' },
  rawFormData:  { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('PlayerRequest', playerRequestSchema);
