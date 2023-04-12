import { GatsbyFunctionRequest, GatsbyFunctionResponse } from "gatsby"
import { PineconeClient, Vector } from "@pinecone-database/pinecone"
import { OpenAIEmbeddings } from "langchain/embeddings"
import removeMarkdown from "remove-markdown"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import Fuse from "fuse.js"
import { findAll } from "highlight-words-core"
import * as stopword from "stopword"

interface QueryBody {
  query: string
}

export default async function handler(
  req: GatsbyFunctionRequest<QueryBody>,
  res: GatsbyFunctionResponse
) {
  const query = req.body.query

  const pinecone: PineconeClient = new PineconeClient()
  console.log(`init pinecone`)
  // await pinecone.init({
  // environment: `asia-southeast1-gcp`,
  // apiKey: `6a992480-151a-4002-b11b-b7b1c9f8d1de`,
  // });
  await pinecone.init({
    environment: `us-central1-gcp`,
    apiKey: `03ceeff7-6f52-41ca-ab7a-186444dc7134`,
  })

  const embedder = new OpenAIEmbeddings({
    modelName: `text-embedding-ada-002`,
  })

  console.time(`get embeddings for query`)
  const embeddings = await embedder.embedQuery(query)
  console.timeEnd(`get embeddings for query`)

  const indexName = `jamstack-crawl`
  const pineconeIndex = pinecone.Index(indexName)

  const queryRequest = {
    vector: embeddings,
    topK: 10,
    includeMetadata: true,
  }

  console.time(`query index`)
  const queryResult = await pineconeIndex.query({
    queryRequest,
  })
  console.timeEnd(`query index`)

  let filterInfo = new Set()
  const mapped = await Promise.all(
    queryResult.matches
      ?.filter((match) => {
        const urlObj = new URL(match.metadata.url)
        urlObj.search = ``
        const key = match.metadata.title + urlObj.toString()
        if (filterInfo.has(key)) {
          return false
        } else {
          filterInfo.add(key)
          return true
        }
      })
      .map(async (match) => {
        let text = removeMarkdown(match.metadata.text)

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 200,
          chunkOverlap: 50,
        })

        const output = await splitter.createDocuments([text])
        const options = {
          // isCaseSensitive: false,
          // includeScore: false,
          // shouldSort: true,
          // includeMatches: false,
          // findAllMatches: false,
          // minMatchCharLength: 1,
          // location: 0,
          // threshold: 0.6,
          // distance: 100,
          // useExtendedSearch: false,
          // ignoreLocation: false,
          // ignoreFieldNorm: false,
          // fieldNormWeight: 1,
          keys: ["pageContent"],
        }

        const fuse = new Fuse(output, options)
        console.log({ query })

        const results = fuse.search(query)
        const textToHighlight = results[0]?.item.pageContent
        const searchWords = stopword.removeStopwords(query.split(` `))

        const chunks = findAll({
          searchWords,
          textToHighlight,
        })

        const highlightedText = chunks
          .map((chunk) => {
            const { end, highlight, start } = chunk
            const text = textToHighlight.substr(start, end - start)
            if (highlight) {
              return `<mark>${text}</mark>`
            } else {
              return text
            }
          })
          .join("")
        console.log({ highlightedText })
        // console.log({text})
        return {
          ...match,
          metadata: {
            ...match.metadata,
            text,
            highlightedText,
          },
          // id: match.id,
          // chunk: match.metadata.chunk,
          // url: match.metadata.url,
          // score: match.score,
        }
      })
  )
  // console.log(mapped)
  // console.log(`hi`)
  res.json(mapped)
}
