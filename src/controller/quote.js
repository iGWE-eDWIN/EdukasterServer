const DailyQuote = require('../models/quote')

const createOrUpdateQuote = async (req, res) => {
try {
    const {text} = req.body
     // Default educational poem (fallback)
    const defaultQuote = `
Education is the light that breaks the darkest night,
A steady flame that guides the will to what is right.
It builds the mind, refines the soul, expands your view,
And shows the world what discipline and dreams can do.

Through every page you read and every lesson learned,
A seed of greatness quietly is being earned.
Not all rewards are seen at once, nor quickly gained,
But every effort writes a future well sustained.

So stay consistent, even when the road feels long,
For knowledge turns the weak into the truly strong.
With every step, let curiosity lead your way,
And shape a brighter, wiser version of today.
    `.trim();

//  if (!text) {
//       return res.status(400).json({ message: 'Quote text is required' });
//     }

     // Use admin text OR fallback
    if (!text || text.trim() === '') {
      text = defaultQuote;
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