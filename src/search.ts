import { PineconeClient, Vector } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings";

console.log(process.argv);
const query = process.argv.slice(2).join(` `);
console.log({ query });
// process.exit()

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

const embedder = new OpenAIEmbeddings({
  modelName: "text-embedding-ada-002",
});

console.time(`get embeddings for query`);
const embeddings = await embedder.embedQuery(query);
console.timeEnd(`get embeddings for query`);

const indexName = `bricolage-blog`;
const pineconeIndex = pinecone.Index(indexName);

const queryRequest = {
  vector: embeddings,
  topK: 5,
  includeMetadata: true,
};

console.time(`query index`);
const queryResult = await pineconeIndex.query({
  queryRequest,
});
console.timeEnd(`query index`);

const mapped =
  queryResult.matches?.map((match) => ({
    ...match,
    metadata: match.metadata
    // id: match.id,
    // chunk: match.metadata.chunk,
    // url: match.metadata.url,
    // score: match.score,
  })) || [];
console.log(mapped);
