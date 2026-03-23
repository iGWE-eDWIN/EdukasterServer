const DailyQuote = require('../models/quote')

const createOrUpdateQuote = async (req, res) => {
try {
    const {text} = req.body
 if (!text) {
      return res.status(400).json({ message: 'Quote text is required' });
    }

     // Deactivate old quote
    await DailyQuote.updateMany({}, { isActive: false });

    // Create new active quote
    const newQuote = await DailyQuote.create({
      text,
      isActive: true,
    });

    res.status(201).json({
      message: 'Daily quote updated successfully',
      quote: newQuote,
    });
} catch (error) {
     res.status(500).json({ message: error.message });
}
}


const getDailyQuote = async (req, res) => {
    try {
         const quote = await DailyQuote.findOne({ isActive: true });

          if (!quote) {
      return res.status(404).json({ message: 'No quote found' });
    }

     res.json(quote);
    } catch (error) {
        res.status(500).json({ message: error.message }); 
    }
}

module.exports = {
    createOrUpdateQuote,
    getDailyQuote
}