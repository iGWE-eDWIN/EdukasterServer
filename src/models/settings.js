require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;



const SettingsSchema = new Schema({
  key: String,
  value: mongoose.Schema.Types.Mixed,
});

module.exports = model('Settings', SettingsSchema);