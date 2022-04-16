# pii-redaction-openai-pdftron

This example leverages OpenAI for identifying PII (names, addresses, DOB) and PDFTron for text extraction and redaction.

![Screenshot](https://github.com/andreysaf/pii-redaction-openai-pdftron/blob/main/screenshot.png?raw=true "Screenshot")

## Installation

Inside of `server/` create a new file called `config.env` and place the demo key from [PDFTron](https://www.pdftron.com/download-center/mac/) and [Open.AI](https://beta.openai.com/docs/introduction):

```
PORT=9000
PDFTRONKEY=
OPENAI_API_KEY=
```

```
cd client
npm i
npm start
```

```
cd server
npm i
npm start
```

## Walkthrough

Node.js server will act as a file storage. [PDFTron Node.js SDK](https://www.pdftron.com/documentation/nodejs/get-started/integration/) will extract text, search, and create markup annotations. [Open.AI](https://openai.com/api/) will detect names and addresses from the text provided by PDFTron.

### PII Identification

`getNamesAndAddressesFromOpenAI` accepts text extracted from a document, and builds a `prompt` that accepts a natural language command to extract names and addresses. It can be modified to search for other information.

```javascript
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
```

### Summarization

Summarization of the contract works in a similar way to PII search, where inside of the `prompt` `Tl;dr` is added to the end of the string that needs to be summarized.

```javascript
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
```
Here is a sample summarization of the file in the repository.

```
This is a contract between a company and a bank for the sale of goods. The company agrees to sell the goods to the bank for a sum of money, and the bank agrees to purchase the goods from the company. The contract includes terms and conditions for the sale and purchase of the goods
```
