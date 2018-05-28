// @flow
/* eslint-disable flowtype/require-parameter-type, flowtype/require-return-type */

import {describe, it, beforeEach, afterEach} from 'mocha'
import {expect} from 'chai'
import {createStore} from 'redux'
import create, {SET_PENDING, RESOLVE, REJECT, initialPromiseState} from '../src'
import sinon from 'sinon'

let clock
beforeEach(() => clock = sinon.useFakeTimers())
afterEach(() => clock.restore())

describe('without typePrefix', () => {
  describe('initialPromiseState', () => {
    it('is correct', () => {
      expect(initialPromiseState).to.deep.equal({
        pending: false,
        fulfilled: false,
        rejected: false,
        value: null,
        reason: null,
      })
    })
  })
  describe('promiseReducer', () => {
    it("ignores irrelevant actions", () => {
      const state = {
        pending: false,
        fulfilled: true,
        rejected: false,
        reason: null,
        value: 42,
      }
      expect(create().reducer(state, {type: 'blah'})).to.deep.equal(state)
    })
    it('works on undefined state', () => {
      const {reducer, setPending, resolve, reject} = create()

      expect(reducer(undefined, {type: 'blah'})).to.deep.equal({
        pending: false,
        fulfilled: false,
        rejected: false,
        reason: null,
        value: null,
      })

      expect(reducer(undefined, setPending())).to.deep.equal({
        pending: true,
        fulfilled: false,
        rejected: false,
        reason: null,
        value: null,
      })

      expect(reducer(undefined, resolve(42))).to.deep.equal({
        pending: false,
        fulfilled: true,
        rejected: false,
        reason: null,
        value: 42,
      })

      const reason = new Error('TEST')

      expect(reducer(undefined, reject(reason))).to.deep.equal({
        pending: false,
        fulfilled: false,
        rejected: true,
        reason,
        value: null,
      })
    })
  })
})

describe('with customizeActionType', () => {
  describe('reducer', () => {
    it("ignores irrelevant actions", () => {
      const state = {
        pending: false,
        fulfilled: true,
        rejected: false,
        reason: null,
        value: 42,
      }
      const {reducer} = create(actionType => `@@test/${actionType}`)
      expect(reducer(state, {type: '@@test/blah'})).to.deep.equal(state)
    })
    it('works on undefined state', () => {
      const {reducer, setPending, resolve, reject} = create(actionType => `@@test/${actionType}`)

      expect(reducer(undefined, setPending())).to.deep.equal({
        pending: true,
        fulfilled: false,
        rejected: false,
        reason: null,
        value: null,
      })

      expect(reducer(undefined, resolve(42))).to.deep.equal({
        pending: false,
        fulfilled: true,
        rejected: false,
        reason: null,
        value: 42,
      })

      const reason = new Error('TEST')

      expect(reducer(undefined, reject(reason))).to.deep.equal({
        pending: false,
        fulfilled: false,
        rejected: true,
        reason,
        value: null,
      })
    })
  })
})

describe('track', () => {
  it('works when most recent promise resolves', (done) => {
    const {track, reducer} = create()
    const {dispatch, getState} = createStore(reducer)

    const promise1 = new Promise(resolve => setTimeout(() => resolve(1), 1000))
    const promise2 = new Promise(resolve => setTimeout(() => resolve(2), 500))

    track(promise1, dispatch)
    track(promise2, dispatch)

    expect(getState()).to.deep.equal({
      pending: true,
      fulfilled: false,
      rejected: false,
      value: null,
      reason: null,
    })

    clock.tick(2000)

    setImmediate(() => {
      expect(getState()).to.deep.equal({
        pending: false,
        fulfilled: true,
        rejected: false,
        value: 2,
        reason: null,
      })
      done()
    })
  })
  it('works when most recent promise rejects', (done) => {
    const {track, reducer} = create()
    const {dispatch, getState} = createStore(reducer)

    const oldError = new Error("old error")
    const reason = new Error("TEST")

    const promise1 = new Promise((resolve, reject) => setTimeout(() => reject(oldError), 1000))
    const promise2 = new Promise((resolve, reject) => setTimeout(() => reject(reason), 500))

    track(promise1, dispatch)
    track(promise2, dispatch)

    expect(getState()).to.deep.equal({
      pending: true,
      fulfilled: false,
      rejected: false,
      value: null,
      reason: null,
    })

    clock.tick(2000)

    setImmediate(() => {
      expect(getState()).to.deep.equal({
        pending: false,
        fulfilled: false,
        rejected: true,
        value: null,
        reason,
      })
      done()
    })
  })
})

describe('renaming everything for subscriptions', () => {
  it('is easy!', () => {
    const subscriptionActionTypes = {
      [SET_PENDING]: 'SET_INITIALIZING',
      [RESOLVE]: 'SET_READY',
      [REJECT]: 'SET_STOPPED',
    }

    function createTrackSubscriptionPromise(customizeActionType = actionType => actionType) {
      const {setPending, resolve, reject, track, reducer} = create(
        actionType => customizeActionType(subscriptionActionTypes[actionType])
      )
      return {
        setInitializing: setPending,
        setReady: resolve,
        setStopped: reject,
        track,
        reducer: (state, action) => {
          const {pending, fulfilled, rejected, reason} = reducer(state, action)
          return {
            initializing: pending,
            ready: fulfilled,
            stopped: rejected,
            error: reason,
          }
        },
      }
    }

    const {setInitializing, setReady, setStopped, reducer} = createTrackSubscriptionPromise(actionType => `@@test/${actionType}`)

    expect(setInitializing()).to.deep.equal({
      type: '@@test/SET_INITIALIZING',
      payload: true,
    })
    expect(setReady()).to.deep.equal({
      type: '@@test/SET_READY',
      payload: undefined,
    })
    expect(setStopped('failure!')).to.deep.equal({
      type: '@@test/SET_STOPPED',
      error: true,
      payload: 'failure!',
    })

    expect(reducer(undefined, {type: 'blah'})).to.deep.equal({
      initializing: false,
      ready: false,
      stopped: false,
      error: null,
    })
    expect(reducer(undefined, setInitializing())).to.deep.equal({
      initializing: true,
      ready: false,
      stopped: false,
      error: null,
    })
    expect(reducer(undefined, setReady())).to.deep.equal({
      initializing: false,
      ready: true,
      stopped: false,
      error: null,
    })
    expect(reducer(undefined, setStopped('failure!'))).to.deep.equal({
      initializing: false,
      ready: false,
      stopped: true,
      error: 'failure!',
    })
  })
})

