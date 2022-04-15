const express = require('express');
const fs = require('fs');
const path = require('path');

const { PDFNet } = require('@pdftron/pdfnet-node');
const mimeType = require('./modules/mimeType');

const filesPath = './files';

const app = express();

app.get('/files/:filename', (req, res) => {
  const inputPath = path.resolve(__dirname, filesPath, req.params.filename);
  fs.readFile(inputPath, function (err, data) {
    if (err) {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
    } else {
      const ext = path.parse(inputPath).ext;
      res.setHeader('Content-type', mimeType[ext] || 'text/plain');
      res.end(data);
    }
  });
});

const extractText = async (filename) => {
  const inputPath = path.resolve(__dirname, filesPath, filename);

  const main = async () => {
    const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await pdfdoc.initSecurityHandler();
    
    let text = '';

    const pageCount = await pdfdoc.getPageCount();

    for (let step = 1; step <= pageCount; step++) {
        const page = await pdfdoc.getPage(step);
        const txt = await PDFNet.TextExtractor.create();
        const rect = await page.getCropBox();
        txt.begin(page, rect);
        text = text + await txt.getAsText();
    }

    return text;
  };

  return await PDFNet.runWithCleanup(main, process.env.PDFTRONKEY);
};

module.exports = app;