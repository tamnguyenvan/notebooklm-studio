/**
 * WebSocket singleton — connects to sidecar at ws://127.0.0.1:8008/ws
 * Dispatches typed events to registered handlers.
 */

type Handler<T = unknown> = (data: T) => void

class WSClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private port = 8008

  connect(port = 8008) {
    this.port = port
    this._open()
  }

  private _open() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`)

      this.ws.onopen = () => {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string)
          if (event.type) {
            this.handlers.get(event.type)?.forEach((h) => h(event))
          }
        } catch {
          // ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this.ws = null
        this.reconnectTimer = setTimeout(() => this._open(), 2000)
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.reconnectTimer = setTimeout(() => this._open(), 2000)
    }
  }

  on<T = unknown>(eventType: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler as Handler)
    return () => this.handlers.get(eventType)?.delete(handler as Handler)
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }
}

export const ws = new WSClient()
