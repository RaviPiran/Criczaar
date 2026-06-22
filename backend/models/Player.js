const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Player name is required'], trim: true },
  club: { type: String, default: '', trim: true },
  battingStyle: {
    type: String,
    enum: ['Right-hand Bat', 'Left-hand Bat', ''],
    default: '',
  },
  bowlingStyle: {
    type: String,
    enum: ['Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin', 'Right-arm Leg-spin',
           'Left-arm Fast', 'Left-arm Medium', 'Left-arm Orthodox', 'Left-arm Wrist-spin', 'N/A', ''],
    default: '',
  },
  photo: { type: String, default: '' },
  basePrice: { type: Number, required: true, default: 0.5 },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  status: {
    type: String,
    enum: ['remaining', 'sold', 'unsold', 'retained'],
    default: 'remaining',
  },
  isRetained: { type: Boolean, default: false },
  retainedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  retainPrice: { type: Number, default: null },
  soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  soldPrice: { type: Number, default: null },
  auctionOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);
