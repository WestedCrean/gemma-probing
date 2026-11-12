import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { GEMMA_MODELS, type GemmaModel, generateContinuation, loadGemma } from './lib/gemma'
import { normalizeForCompare } from './lib/normalize'

type BookIndexItem = { id: string; title: string; author: string; source: string }
type BookData = BookIndexItem & { fragments: string[] }
type MatchState = 'pending' | 'match' | 'mismatch'

function mockContinuation(prompt: string): string {
  return `${prompt.split(' ').slice(0, 8).join(' ')} ...`
}

function App() {
  const [books, setBooks] = useState<BookIndexItem[]>([])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [book, setBook] = useState<BookData | null>(null)
  const [selectedModelId, setSelectedModelId] = useState(GEMMA_MODELS[0].id)
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [modelMessage, setModelMessage] = useState('No model loaded. Using mock generator.')
  const [actualLines, setActualLines] = useState<string[]>([])
  const [generatedLines, setGeneratedLines] = useState<string[]>([])
  const [lineStates, setLineStates] = useState<MatchState[]>([])

  const selectedModel = useMemo<GemmaModel>(() => GEMMA_MODELS.find((m) => m.id === selectedModelId) ?? GEMMA_MODELS[0], [selectedModelId])

  useEffect(() => {
    fetch('/books/index.json').then((r) => r.json()).then((data: BookIndexItem[]) => {
      setBooks(data)
      setSelectedBookId(data[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (!selectedBookId) return
    fetch(`/books/${selectedBookId}.json`).then((r) => r.json()).then((data: BookData) => {
      setBook(data)
      const first = data.fragments[0] ?? ''
      setActualLines([first])
      setGeneratedLines([first])
      setLineStates(['pending'])
    })
  }, [selectedBookId])

  const onLoadModel = async () => {
    setModelState('loading')
    setModelMessage('Loading model…')
    try {
      await loadGemma(selectedModel)
      setModelState('loaded')
      setModelMessage(`Loaded ${selectedModel.label}.`)
    } catch (error) {
      setModelState('error')
      setModelMessage(error instanceof Error ? error.message : 'Failed to load model.')
    }
  }

  const onGenerate = async () => {
    if (!book) return
    const previousActual = actualLines[actualLines.length - 1] ?? ''
    const nextActual = book.fragments[actualLines.length]
    if (!nextActual) return

    setLineStates((prev) => prev.map((s) => (s === 'match' ? 'pending' : s)))

    let nextGenerated = ''
    if (modelState === 'loaded') {
      try {
        nextGenerated = await generateContinuation(selectedModel, previousActual)
      } catch {
        nextGenerated = mockContinuation(previousActual)
      }
    } else {
      nextGenerated = mockContinuation(previousActual)
    }

    const isMatch = normalizeForCompare(nextActual) === normalizeForCompare(nextGenerated)
    setActualLines((prev) => [...prev, nextActual])
    setGeneratedLines((prev) => [...prev, nextGenerated])
    setLineStates((prev) => [...prev, isMatch ? 'match' : 'mismatch'])
  }

  const stats = useMemo(() => {
    const compared = lineStates.filter((s) => s !== 'pending').length
    const matches = lineStates.filter((s) => s === 'match').length
    return { compared, matches, accuracy: compared ? Math.round((matches / compared) * 100) : 0 }
  }, [lineStates])

  return (
    <main className="app-shell">
      <header className="card">
        <h1>Gemma Probing</h1>
        <p>Test whether a local Gemma model can continue public-domain classics one fragment at a time.</p>
      </header>

      <section className="card controls">
        <label>Book
          <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
          </select>
        </label>
        <label>Model
          <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}>
            {GEMMA_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" onClick={onLoadModel} disabled={modelState === 'loading'}>Load / Download Model</button>
        <span className={`badge ${modelState}`}>{modelMessage}</span>
      </section>

      <section className="card panels-wrap">
        <div className="panel-head">
          <h2>{book?.title ?? 'Book'}</h2>
          <button type="button" className="primary" onClick={onGenerate}>Generate Next</button>
        </div>
        <p className="helper">Left is canonical text. Right is Gemma's continuation from the previous canonical line.</p>
        <div className="panels">
          <div className="panel"><h3>Actual fragments</h3>{actualLines.map((line, i) => <div key={`a-${i}`} className={`row ${lineStates[i]}`}><span>{i + 1}</span><code>{line}</code></div>)}</div>
          <div className="panel"><h3>Generated fragments</h3>{generatedLines.map((line, i) => <div key={`g-${i}`} className={`row ${lineStates[i]}`}><span>{i + 1}</span><code>{line}</code></div>)}</div>
        </div>
      </section>

      <section className="card stats">
        <strong>Match stats:</strong> {stats.matches} / {stats.compared} exact normalized matches ({stats.accuracy}%)
      </section>
    </main>
  )
}

export default App
