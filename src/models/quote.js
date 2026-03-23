require('dotenv').config();
const mongoose = require('mongoose');
const { Schema, model } = mongoose;


dailyQuoteSchema = new Schema({
  text: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },  
}, { timestamps: true }
)

const DailyQuote = model('DailyQuote', dailyQuoteSchema)
module.exports = DailyQuote;