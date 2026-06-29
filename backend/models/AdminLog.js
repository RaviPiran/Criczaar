const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  admin:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:  {
    type: String,
    enum: ['role_change', 'user_delete', 'room_status', 'room_delete', 'price_correction', 'player_revert'],
    required: true,
  },
  message: { type: String, required: true }, // human-readable summary shown in the dashboard
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

adminLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminLog', adminLogSchema);
