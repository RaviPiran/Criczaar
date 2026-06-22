const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Team name is required'], trim: true },
  color: { type: String, default: '#4361ee' },
  logo: { type: String, default: '' },   // base64 or URL
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  budget: { type: Number, required: true, default: 100 },
  budgetLeft: { type: Number, required: true },
  slots: { type: Number, default: 11 },
  rtmCards: { type: Number, default: 2 },
  retainedPlayers: [
    {
      player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      retainPrice: Number,
    }
  ],
  players: [
    {
      player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      soldPrice: Number,
      isRetained: { type: Boolean, default: false },
    }
  ],
}, { timestamps: true });

teamSchema.virtual('playerCount').get(function () { return this.players.length; });
teamSchema.virtual('slotsLeft').get(function () { return this.slots - this.players.length; });
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
