const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const { PDFNet } = require('@pdftron/pdfnet-node');

const filesPath = './files';

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

extractText('legal-contract.pdf');
