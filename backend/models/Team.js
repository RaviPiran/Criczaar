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

// FIX: virtuals run on every JSON serialization (res.json), including for
// legacy team docs where `players` can be null/undefined instead of [].
// `this.players.length` on such a doc throws "Cannot read properties of
// undefined (reading 'length')" and kills the ENTIRE /full response (all
// teams + players), which is why "Enter Auction" failed with no data
// loading at all. Guard with `?.length || 0` so a bad doc can never take
// down the whole route again — independent of any DB-side null cleanup.
teamSchema.virtual('playerCount').get(function () { return this.players?.length || 0; });
teamSchema.virtual('slotsLeft').get(function () { return this.slots - (this.players?.length || 0); });
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);