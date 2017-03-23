// @flow

/* eslint-disable flowtype/require-parameter-type, flowtype/require-return-type */

import {describe, it, beforeEach, afterEach} from 'mocha'
import {expect} from 'chai'
import {createStore, bindActionCreators} from 'redux'
import {
  promiseReducer, promiseActionCreators, trackPromise, createPromiseTracker,
  SET_PENDING, RESOLVE, REJECT,
  initialPromiseState,
} from '../src'
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
      expect(promiseReducer()(state, {type: 'blah'})).to.deep.equal(state)
    })
    it('works on undefined state', () => {
      const reducer = promiseReducer()
      const {setPending, resolve, reject} = promiseActionCreators()

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

describe('with cutomizeActionType', () => {
  describe('promiseReducer', () => {
    it("ignores irrelevant actions", () => {
      const state = {
        pending: false,
        fulfilled: true,
        rejected: false,
        reason: null,
        value: 42,
      }
      const actionCreators = promiseActionCreators(actionType => `@@test/${actionType}`)
      expect(promiseReducer(actionCreators)(state, {type: '@@test/blah'})).to.deep.equal(state)
    })
    it('works on undefined state', () => {
      const actions = promiseActionCreators(actionType => `@@test/${actionType}`)
      const reducer = promiseReducer(actions)
      const {setPending, resolve, reject} = actions

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

describe('trackPromise', () => {
  it("assumes actions are bound when dispatch isn't given", (done) => {
    const {dispatch, getState} = createStore(promiseReducer())
    const actionCreators = bindActionCreators(promiseActionCreators(), dispatch)

    const promise = new Promise(resolve => setTimeout(() => resolve(1), 1000))

    trackPromise(promise, {actionCreators})

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
        value: 1,
        reason: null,
      })
      done()
    })
  })
})

describe('createPromiseTracker', () => {
  describe('with ignoreOldPromises', () => {
    it('works when most recent promise resolves', (done) => {
      const {dispatch, getState} = createStore(promiseReducer())
      const actionCreators = promiseActionCreators()

      const promise1 = new Promise(resolve => setTimeout(() => resolve(1), 1000))
      const promise2 = new Promise(resolve => setTimeout(() => resolve(2), 500))

      const trackPromise = createPromiseTracker({dispatch, actionCreators, ignoreOldPromises: true})
      trackPromise(promise1)
      trackPromise(promise2)

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
      const {dispatch, getState} = createStore(promiseReducer())
      const actionCreators = promiseActionCreators()

      const oldError = new Error("old error")
      const reason = new Error("TEST")

      const promise1 = new Promise((resolve, reject) => setTimeout(() => reject(oldError), 1000))
      const promise2 = new Promise((resolve, reject) => setTimeout(() => reject(reason), 500))

      const trackPromise = createPromiseTracker({dispatch, actionCreators, ignoreOldPromises: true})
      trackPromise(promise1)
      trackPromise(promise2)

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
})

describe('renaming everything for subscriptions', () => {
  it('is easy!', () => {
    const subscriptionActionTypes = {
      [SET_PENDING]: 'SET_INITIALIZING',
      [RESOLVE]: 'SET_READY',
      [REJECT]: 'SET_STOPPED',
    }

    function subscriptionActionCreators(customizeActionType = actionType => actionType) {
      const {setPending, resolve, reject} = promiseActionCreators(
        actionType => customizeActionType(subscriptionActionTypes[actionType])
      )
      return {setInitializing: setPending, setReady: resolve, setStopped: reject}
    }

    function subscriptionReducer(actions) {
      const {setInitializing, setReady, setStopped} = actions
      const wrappedReducer = promiseReducer({setPending: setInitializing, resolve: setReady, reject: setStopped})
      return (state, action) => {
        const {pending, fulfilled, rejected, reason} = wrappedReducer(state, action)
        return {
          initializing: pending,
          ready: fulfilled,
          stopped: rejected,
          error: reason,
        }
      }
    }

    const actionCreators = subscriptionActionCreators(actionType => `@@test/${actionType}`)
    const {setInitializing, setReady, setStopped} = actionCreators

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

    const reducer = subscriptionReducer(actionCreators)

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

