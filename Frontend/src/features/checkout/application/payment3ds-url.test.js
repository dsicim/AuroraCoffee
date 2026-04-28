import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { remove3DSCallbackResultFromUrl } from './payment3ds.js'

beforeEach(() => {
  globalThis.window = {
    location: {
      pathname: '/checkout/3dscallback',
      hash: '#receipt',
    },
    history: {
      state: { key: 'aurora' },
      calls: [],
      replaceState(state, title, url) {
        this.calls.push({ state, title, url })
      },
    },
  }
})

describe('3DS callback URL cleanup', () => {
  it('removes the 3DS result payload and keeps unrelated URL state', () => {
    remove3DSCallbackResultFromUrl(new URLSearchParams('result=bank-payload&next=orders'))

    assert.deepEqual(window.history.calls, [
      {
        state: { key: 'aurora' },
        title: '',
        url: '/checkout/3dscallback?next=orders#receipt',
      },
    ])
  })

  it('removes the query string when result is the only parameter', () => {
    remove3DSCallbackResultFromUrl(new URLSearchParams('result=bank-payload'))

    assert.equal(window.history.calls[0].url, '/checkout/3dscallback#receipt')
  })
})
