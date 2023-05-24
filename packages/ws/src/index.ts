import N from '@alaq/nucleus/index'

export interface WsClientOptions {
  url?: string
  reconnect?: boolean
  queue?: boolean
  autoJson?: boolean
  recConnectIntensity?: number //reconnectCount * Math.log10(recConnectIntensity))
}

export default function WsClient(options: WsClientOptions = {} as WsClientOptions) {
  const o = Object.assign(
    {
      url: `${location.protocol === 'https' ? 'wss' : 'ws'}://${location.host}`,
      reconnect: true,
      queue: true,
      autoJson: true,
      recConnectIntensity: 24,
    },
    options,
  )
  const isConnected = N().safe()

  const send = N.stateless()
  const error = N.stateless()
  const nws = N<WebSocket>()
  const queue = []

  const rawDataNucleon = N.stateless() as INucleon<string>
  const dataNucleon = N.stateless()

  const instance = {
    isConnected,
    sendRaw,
    send,
    raw: rawDataNucleon,
    data: dataNucleon,
    ws: nws,
    error,
  }

  function sendRaw(data: string) {
    if (isConnected.value) {
      nws.value.send(data)
    } else {
      queue.push(data)
    }
  }

  let reConnectCount = 0
  send.up((data) => sendRaw(JSON.stringify(data)))

  function onOpenHandler(e) {
    reConnectCount = 0
    instance.isConnected(true)
    if (queue.length) {
      queue.forEach(sendRaw)
    }
  }

  function onMessageHandler(ev: MessageEvent) {
    dataNucleon.haveListeners && dataNucleon(JSON.parse(ev.data))
    rawDataNucleon.haveListeners && rawDataNucleon(ev.data)
  }

  function onCloseHandler(e: CloseEvent) {
    instance.isConnected(false)
    if (o.reconnect) {
      setTimeout(() => {
        reConnectCount++
        connect()
      }, reConnectCount * Math.log10(24))
    }
  }

  function onErrorHandler(e: Event) {
    e.stopPropagation()
    e.stopImmediatePropagation()
    error(e)
    console.log('websocket error')
  }

  nws.up((ws) => {
    ws.onopen = onOpenHandler
    ws.onclose = onCloseHandler
    ws.onmessage = onMessageHandler
    ws.onerror = onErrorHandler
  })

  function connect() {
    nws(new WebSocket(o.url))
  }

  connect()
  return instance
}
