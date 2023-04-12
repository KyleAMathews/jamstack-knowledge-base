import YAML from "yaml"
import fs from "fs"
import PQueue from "p-queue"
import { PineconeClient, CreateRequest } from "@pinecone-database/pinecone"
import crawl from "./main"

const indexName = `jamstack-crawl`

async function main() {
  const pinecone: PineconeClient = new PineconeClient()
  await pinecone.init({
    environment: `us-central1-gcp`,
    apiKey: `03ceeff7-6f52-41ca-ab7a-186444dc7134`,
  })

  const crawlQueue = new PQueue({ concurrency: 1 })
  // Recreate pinecone index.
  // console.time(`drop index`)
  // const indexes = await pinecone.listIndexes()
  // console.log({ indexes })
  // if (indexes.includes(indexName)) await pinecone.deleteIndex({ indexName })
  // const createRequest: CreateRequest = {
  // name: indexName,
  // dimension: 1536,
  // metric: `cosine`,
  // }
  // await pinecone.createIndex({
  // createRequest,
  // })
  // console.timeEnd(`drop index`)
  //
  // Read yaml file.
  const config = YAML.parse(
    fs.readFileSync(`./src/crawl-manifest.yaml`, `utf-8`)
  )
  // validate each object
  // start crawling/indexing — 2 concurrency
  config.forEach((service) => {
    console.log({ service })
    service.baseUrls.forEach((baseUrl) => {
      crawlQueue.add(async () => {
        console.log({ baseUrl })
        await crawl(baseUrl)
      })
    })
  })
  // -- pass in name + keywords.
  // log out progress
}
main()
