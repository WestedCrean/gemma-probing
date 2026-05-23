export type GemmaModel = {
  id: string
  label: string
  modelAssetPath: string
}

export const GEMMA_MODELS: GemmaModel[] = [
  { id: 'gemma-3n-e2b-web', label: 'Gemma 3n E2B Web', modelAssetPath: '/models/gemma-3n-E2B-it-int4.task.litertlm' },
  { id: 'gemma-3n-e4b-web', label: 'Gemma 3n E4B Web', modelAssetPath: '/models/gemma-3n-E4B-it-int4.task.litertlm' },
]

let llm: any = null
let loadedModelId: string | null = null

async function importGenAi() {
  const dynamicImporter = new Function('s', 'return import(s)') as (s: string) => Promise<any>
  return dynamicImporter('@mediapipe/tasks-genai')
}

export async function loadGemma(model: GemmaModel) {
  if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.')
  if (loadedModelId === model.id && llm) return

  const ok = await fetch(model.modelAssetPath, { method: 'HEAD' }).then((r) => r.ok).catch(() => false)
  if (!ok) throw new Error(`Model file not found at ${model.modelAssetPath}. Add it to public/models.`)

  const tasks = await importGenAi()
  const genai = await tasks.FilesetResolver.forGenAiTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm')
  llm = await tasks.LlmInference.createFromModelPath(genai, model.modelAssetPath)
  loadedModelId = model.id
}

export async function generateContinuation(model: GemmaModel, promptSentence: string): Promise<string> {
  if (!llm || loadedModelId !== model.id) throw new Error('Model is not loaded yet.')
  const response = await llm.generateResponse(promptSentence, { maxTokens: 48, temperature: 0, topK: 1, randomSeed: 42 })
  return String(response ?? '').trim()
}
