require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;

promotionSchema = new Schema({
  title: {
    type: String,
    // required: true,
  },
  message: {
    type: String,
    // required: true,
  },
  mediaUrl: {
    type: String,
    // required: true,
    enum: ['text', 'image', 'video'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
module.exports = model('Promotion', promotionSchema);
