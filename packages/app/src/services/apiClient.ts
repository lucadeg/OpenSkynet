const API_BASE = 'http://localhost:3001'

export async function apiGet<T>(path: string, params?: Record<string,string>): Promise<T> {
  const url = new URL(path, API_BASE)
  if (params) for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export function apiStream(
  path: string,
  body: any,
  onEvent: (type: string, data: any) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
): () => void {
  let controller = new AbortController()
  
  fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API ${res.status}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      
      for (const part of parts) {
        const lines = part.split('\n')
        let event = 'message'
        let data = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7)
          else if (line.startsWith('data: ')) data = line.slice(6)
        }
        if (data) {
          try { onEvent(event, JSON.parse(data)) } catch { onEvent(event, data) }
        }
      }
    }
    onDone?.()
  }).catch((err) => {
    if (err.name === 'AbortError') return
    onError?.(err)
  })
  
  return () => controller.abort()
}
