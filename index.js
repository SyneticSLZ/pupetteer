const express = require('express');
const { handleScrapeRequest } = require('./scrapeLogic');

const app = express();
const PORT = 4000;

app.get('/scrape', handleScrapeRequest);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});