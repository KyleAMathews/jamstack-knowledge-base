import * as React from "react"
import type { HeadFC, PageProps } from "gatsby"

const IndexPage: React.FC<PageProps> = () => {
  const [query, setQuery] = React.useState(``)
  const [results, setResults] = React.useState(``)
  async function onSubmit(e) {
    e.preventDefault()
    console.log({ query })
    // Make API call
    fetch(`/api/query`, {
      method: `POST`,
      body: JSON.stringify({ query }),
      headers: {
        "content-type": `application/json`,
      },
    })
      .then((res) => res.json())
      .then((body) => {
        console.log(`response from API:`, body)
        setResults(body)
      })
  }

  console.log({ results })
  return (
    <main>
      <h1 className="text-3xl font-bold">Search</h1>
      <form onSubmit={onSubmit}>
        <input
          type="text"
          onChange={(e) => setQuery(e.target.value)}
          className="border border-gray-700 w-96 p-2"
        />
      </form>
      <h2 className="text-2xl font-bold">results</h2>
      {results &&
        results.map((result) => {
          return (
            <div className="mb-5" key={result.id}>
              <a target="_blank" href={result.metadata.url} rel="noreferrer">
                <h2 className="font-bold text-xl">
                  {result.metadata.title}
                </h2>
                <small>{result.metadata.url}</small>
                <div dangerouslySetInnerHTML={{__html: result.metadata.highlightedText}} />
              </a>
            </div>
          )
        })}
    </main>
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>Home Page</title>
