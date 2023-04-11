import { PineconeClient, Vector } from "@pinecone-database/pinecone";
import { CheerioCrawler, Dataset } from "crawlee";
import TurndownService from "turndown";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { v4 as uuidv4 } from "uuid";
import { PineconeStore } from "langchain/vectorstores";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import PQueue from "p-queue";
import sanitizeHtml from 'sanitize-html';

const indexQueue = new PQueue({ concurrency: 1 });

const turndownService = new TurndownService();

const pinecone: PineconeClient = new PineconeClient();
console.log("init pinecone");
// await pinecone.init({
// environment: `asia-southeast1-gcp`,
// apiKey: `6a992480-151a-4002-b11b-b7b1c9f8d1de`,
// });
await pinecone.init({
  environment: `us-central1-gcp`,
  apiKey: `03ceeff7-6f52-41ca-ab7a-186444dc7134`,
});
// pinecone.projectName = `Default Project`;
console.log({ pinecone });

// const startUrls = ["https://bricolage.io"];
// const startUrls = ["https://fly.io/docs/"];
const startUrls = ["https://docs.netlify.com/"];

const truncateStringByBytes = (str: string, bytes: number) => {
  const enc = new TextEncoder();
  return new TextDecoder("utf-8").decode(enc.encode(str).slice(0, bytes));
};

const sliceIntoChunks = (arr: Vector[], chunkSize: number) => {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
    arr.slice(i * chunkSize, (i + 1) * chunkSize)
  );
};

const crawler = new CheerioCrawler({
  // maxRequestsPerCrawl: 3,
  async requestHandler({ $, request, enqueueLinks }) {
    await enqueueLinks({
      // regexps: [/docs.*/],
      strategy: `same-hostname`,
      exclude: [
        "[http|https]://[((?!\\.jpg$|\\.png$|\\.jpeg$|\\.gif$|\\.pdf$|\\.doc$|\\.txt$|\\.zip$).)*]",
      ],
    });

    // Remove obviously superfulous elements.
    $("script").remove();
    $("header").remove();
    $("nav").remove();
    const title = $("title").text() || "";
    const html = sanitizeHtml($("body").html())
    // console.log(html)
    const text = turndownService.turndown(html);
    // console.log(text)

    const page: Page = {
      url: request.loadedUrl,
      text,
      title,
    };
    console.log(`The title of "${request.url}" is: ${title}.`);
    await Dataset.pushData({
      url: request.loadedUrl,
      text,
      title,
    });
  },
});

await crawler.run(startUrls);
// process.exit()
const data = await Dataset.getData();
// console.log(data)

const documents = await Promise.all(
  data.items.map((row) => {
    const splitter = new RecursiveCharacterTextSplitter({
      // chunkSize: 300,
      // chunkOverlap: 20,
    });

    const docs = splitter.splitDocuments([
      new Document({
        pageContent: row.text,
        metadata: {
          title: row.title,
          url: row.url,
          text: truncateStringByBytes(row.text, 36000),
        },
      }),
    ]);
    return docs;
  })
);

// console.log(documents);

const embedder = new OpenAIEmbeddings({
  modelName: "text-embedding-ada-002",
});

// const indexName = `test-blog`;
const indexName = `bricolage-blog`;
const pineconeIndex = pinecone.Index(indexName);
const describe = await pinecone.describeIndex({ indexName });
const indexes = await pinecone.listIndexes();
console.log({ describe, indexes });
// const stats = await pineconeIndex.describeIndexStats()
// console.log({stats})

console.log(`docs`, documents.flat().length);
// process.exit()

const chunks = sliceIntoChunks(documents.flat(), 10);

await Promise.all(
  chunks.map(async (chunk) => {
    await indexQueue.add(async () => {
      console.log(`indexing chunk`);
      try {
        await PineconeStore.fromDocuments(chunk, embedder, {
          pineconeIndex,
        });
      } catch (e) {
        console.log(e);
      }
    });
    console.log(`done indexing chunk`, chunk.length);
  })
);

// const vectors = await Promise.all(
// documents.flat().map(async (doc) => {
// const embedding = await embedder.embedQuery(doc.pageContent);
// console.log("done embedding", doc.metadata.url);
// return {
// id: uuidv4(),
// values: embedding,
// metadata: {
// chunk: doc.pageContent,
// text: doc.metadata.text as string,
// url: doc.metadata.url as string,
// },
// } as Vector;
// })
// );

// console.log(`got vectors`, vectors.length);
// const chunks = sliceIntoChunks(vectors, 10);
// console.log(chunks[0])

// await Promise.all(
// chunks.map(async (chunk) => {
// await pineconeIndex.upsert({
// upsertRequest: {
// vectors: chunk as Vector[],
// },
// });
// })
// );
