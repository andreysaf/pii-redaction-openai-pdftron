const express = require('express');
const fs = require('fs');
const path = require('path');

// PDFTron
const { PDFNet } = require('@pdftron/pdfnet-node');

// OpenAI
const { Configuration, OpenAIApi } = require('openai');

const mimeType = require('./modules/mimeType');

const filesPath = './files';
const app = express();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.get('/files/:filename', (req, res) => {
  const inputPath = path.resolve(__dirname, filesPath, req.params.filename);
  fs.readFile(inputPath, function (err, data) {
    if (err) {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
    } else {
      const ext = path.parse(inputPath).ext;
      res.setHeader('Content-type', mimeType[ext] || 'text/plain');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.end(data);
    }
  });
});

app.get('/getRedaction/:filename', (req, res) => {
  createPIIMarkUpRedactions(req.params.filename)
    .then((data) => {
      res.setHeader('Content-type', 'text/plain');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.json({ xfdf: data });
      res.end();
    })
    .catch((err) => {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
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
      text = text + (await txt.getAsText());
    }

    return text;
  };

  return await PDFNet.runWithCleanup(main, process.env.PDFTRONKEY);
};

const getNamesAndAddressesFromOpenAI = async (text) => {
  return await openai.createCompletion('text-davinci-002', {
    prompt: `Extract names and address from this text: ${text}`,
    temperature: 0,
    max_tokens: 64,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  });
};

const summarizeTheContract = async (text) => {
  return await openai.createCompletion('text-davinci-002', {
    prompt: `${text} \n\nTl;dr`,
    temperature: 0.7,
    max_tokens: 60,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
  });
};

const searchForTextAndCreateMarkupRedactions = async (text, filename) => {
  const inputPath = path.resolve(__dirname, filesPath, filename);

  const main = async () => {
    const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await pdfdoc.initSecurityHandler();

    const txtSearch = await PDFNet.TextSearch.create();

    let pattern = text;

    //use regular expression to find credit card number
    let mode = PDFNet.TextSearch.Mode.e_highlight;
    txtSearch.setMode(mode);
    txtSearch.setPattern(pattern);

    //call Begin() method to initialize the text search.
    txtSearch.begin(pdfdoc, pattern, mode);
    const result = await txtSearch.run();

    if (result.code === PDFNet.TextSearch.ResultCode.e_found) {
      // add a redaction annotation based on the location of the found instance
      hlts = result.highlights;
      await hlts.begin(pdfdoc); // is await needed?
      while (await hlts.hasNext()) {
        const curPage = await pdfdoc.getPage(await hlts.getCurrentPageNumber());
        const quadArr = await hlts.getCurrentQuads();
        for (let i = 0; i < quadArr.length; ++i) {
          const currQuad = quadArr[i];
          const x1 = Math.min(
            Math.min(Math.min(currQuad.p1x, currQuad.p2x), currQuad.p3x),
            currQuad.p4x
          );
          const x2 = Math.max(
            Math.max(Math.max(currQuad.p1x, currQuad.p2x), currQuad.p3x),
            currQuad.p4x
          );
          const y1 = Math.min(
            Math.min(Math.min(currQuad.p1y, currQuad.p2y), currQuad.p3y),
            currQuad.p4y
          );
          const y2 = Math.max(
            Math.max(Math.max(currQuad.p1y, currQuad.p2y), currQuad.p3y),
            currQuad.p4y
          );

          const redactionMarkup = await PDFNet.RedactionAnnot.create(
            pdfdoc,
            await PDFNet.Rect.init(x1, y1, x2, y2)
          );
          await redactionMarkup.setColor(await PDFNet.ColorPt.init(1, 0, 0), 3);
          await curPage.annotPushBack(redactionMarkup);
        }
        hlts.next();
      }
    }

    const doc_fields = await pdfdoc.fdfExtract(
      PDFNet.PDFDoc.ExtractFlag.e_annots_only
    );

    // Export annotations from FDF to XFDF.
    const xfdf_data = await doc_fields.saveAsXFDFAsString();

    return xfdf_data;
  };

  return await PDFNet.runWithCleanup(main, process.env.PDFTRONKEY);
};

const createPIIMarkUpRedactions = async (filename) => {
  // extract text from a document
  const textToSearch = await extractText(filename);

  // pass the text for processing to OpenAI to find PII
  //const response = await getNamesAndAddressesFromOpenAI(textToSearch);

  // pass the returned text to search and create markup redactions
  const xfdfData = await searchForTextAndCreateMarkupRedactions(
    '1313 Broad Street, Vancouver, BC',
    filename
  );

  // pass the text for processing to OpenAI to summarize the contract
  // const summary = await summarizeTheContract(textToSearch);

  return xfdfData;
};

module.exports = app;
