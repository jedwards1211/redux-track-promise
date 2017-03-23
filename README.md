# redux-track-promise

[![Greenkeeper badge](https://badges.greenkeeper.io/jedwards1211/redux-track-promise.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/jedwards1211/redux-track-promise.svg?branch=master)](https://travis-ci.org/jedwards1211/redux-track-promise)
[![Coverage Status](https://coveralls.io/repos/github/jedwards1211/redux-track-promise/badge.svg?branch=master)](https://coveralls.io/github/jedwards1211/redux-track-promise?branch=master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

A tiny redux library with a reducer that handles `setPending`, `resolve`, and `reject` actions, and a `trackPromise`
method that takes a `Promise` and dispatches those actions when the promise state changes.

I used to write a lot of similar reducers and action creators for keeping track of asynchronous operations, but I got
tired of repeating myself and wrote this library to use in all of those cases.

## Getting started

### `npm install redux-track-promise`

### Import stuff

```js
import {promiseActionCreators, promiseReducer, createPromiseTracker} from 'redux-track-promise'
```

### Customize action types

Let's say you want to track promises from calling two HTTP routes: a login route and a setPassword route.
Create functions that customize `redux-track-promise`'s action types for both routes:
```js
const loginPromiseActionType = actionType => `LOGIN_PROMISE.${actionType}`
const setPasswordPromiseActionType = actionType => `SET_PASSWORD_PROMISE.${actionType}`
```

### Create promise action creators

Call `promiseActionCreators` with your custom action type functions from the previous step:
```js
const loginPromiseActionCreators = promiseActionCreators(loginPromiseActionType)
const setPasswordPromiseActionCreators = promiseActionCreators(setPasswordPromiseActionType)
```

### Create promise reducers

Call `promiseReducer` with your action creators from the previous step (this tells it which action types to respond to):
```js
const loginPromiseReducer = promiseReducer(loginPromiseActionCreators)
const setPasswordPromiseReducer = promiseReducer(setPasswordPromiseActionCreators)
```

### Hook promise reducers into your app reducer

Let's say you're using `combineReducers` to make your app reducer.
```js
const reducer = combineReducers({
  loginPromise: loginPromiseReducer,
  setPasswordPromise: setPasswordPromiseReducer,
})

const store = createStore(reducer)
```

### Create promise tracker functions

```js
const trackLoginPromise = createPromiseTracker({
  dispatch: store.dispatch,
  actionCreators: loginPromiseActionCreators,
})
const trackSetPasswordPromise = createPromiseTracker({
  dispatch: store.dispatch,
  actionCreators: setPasswordPromiseActionCreators,
})
```

You can omit `dispatch` and pass `actionCreators` that are bound to a dispatch function via `bindActionCreators`.
As with `bindActionCreators`, if you're using `react-redux`, `mapDispatchToProps` is a good place to use
`createPromiseTracker`.

### Call promise tracker to sync a promise into redux

```js
const promise = popsicle.post('/login', {username: 'jimbob', password: 'trump2024'})
trackLoginPromise(promise)
```

Alternatively, you can `import {trackPromise} from 'redux-track-promise'` and call it with `dispatch` and
`actionCreators`:
```js
import {trackPromise} from 'redux-track-promise'
trackPromise(promise, {dispatch: store.dispatch, actionCreators: setPasswordPromiseActionCreators})
```
Again, you can omit `dispatch` and pass `actionCreators` that are bound to a dispatch function via `bindActionCreators`.

#### Results
Right after you call `trackLoginPromise`, the state will look like this:
```js
{
  loginPromise: {
    pending: true,
    fulfilled: false,
    rejected: false,
    value: null,
    reason: null,
  },
  setPasswordPromise: {
    pending: false,
    fulfilled: false,
    rejected: false,
    value: null,
    reason: null,
  }
}
```
Then say `promise` resolves to `{token: 'C4|\|7 |-|4C|< 7|-||5', expiresAt: '2025-01-20'}`.  Then the state will
look like this:
```js
{
  loginPromise: {
    pending: false,
    fulfilled: true,
    rejected: false,
    value: {token: 'C4|\|7 |-|4C|< 7|-||5', expiresAt: '2025-01-20'},
    reason: null,
  },
  setPasswordPromise: {
    pending: false,
    fulfilled: false,
    rejected: false,
    value: null,
    reason: null,
  }
}
```

### Or dispatch actions manually

```js
const {setPending, resolve, reject} = loginPromiseActionCreators

dispatch(setPending)
login(username, password, (error, result) => {
  if (error) return dispatch(reject(error))
  dispatch(resolve(result))
})
```

(Of course, you could just use `es6-promisify` on a method that takes a callback and pass its promise to
`trackPromise`.  You may prefer to dispatch actions manually if your async operation involves more than a single
function call.)

### What if you need to track a new promise before an old one finishes?

If the old promise finishes after the new one, you wouldn't want its outcome to overwrite the new promise's outcome!
Got you covered -- `trackPromise` returns an object with a `cancel` function.  Calling it will prevent it from
dispatching `resolve` or `reject` if it hasn't already:
```js
let loginTracker
function login(username, password) {
 if (loginTracker) loginTracker.cancel() // ignore last promise
 const promise = popsicle.post('/login', {username: 'jimbob', password: 'trump2024'})
 loginTracker = trackLoginPromise(promise)
}
```

Or you can pass the `ignoreOldPromises` option to `createPromiseTracker`:
```js
const trackLoginPromise = createPromiseTracker({
  dispatch: store.dispatch,
  actionCreators: loginPromiseActionCreators,
  ignoreOldPromises: true
})
const trackSetPasswordPromise = createMostRecentPromiseTracker({
  dispatch: store.dispatch,
  actionCreators: setPasswordPromiseActionCreators,
  ignoreOldPromises: true
})

function login(username, password) {
  const promise = popsicle.post('/login', {username, password})
  trackLoginPromise(promise)
}
function setPassword(username, oldPassword, newPassword) {
  const promise = popsicle.post('/setPassword', {username, oldPassword, newPassword})
  trackSetPasswordPromise(promise)
}
```

## The fourth (initial) state

Unlike promises, which can be in one of three states (pending, fulfilled, or rejected), the initial redux state can be
none of the above:
```js
{
  pending: false,
  fulfilled: false,
  rejected: false,
  value: null,
  reason: null,
}
```
This is so that the state won't indicate some operation is pending before you've ever called `setPending`
(or `trackPromise`).

You can manually return to this state if you want by dispatching `setPending(false)`.  You might want to do this if you
are displaying pending/fulfilled/rejected status in the UI and want to make it go away (for example, if the user clicks
the X on your status banner).

## How to rename all action types, action creators, and state fields

Let's say you want to track the state of a Meteor subscription.  Using this library makes total sense: `pending`
can mean the subscription is sending initial data, `fulfilled` can mean it's ready, and `rejected` can mean it stopped.
But what if you want the names of these fields and the action types to match Meteor terminology?

Here's how you could do it:

```js
const subscriptionActionTypes = {
  [SET_PENDING]: 'SET_INITIALIZING',
  [RESOLVE]: 'SET_READY',
  [REJECT]: 'SET_STOPPED',
}

function subscriptionActions(customizeActionType = actionType => actionType) {
  const {setPending, resolve, reject} = promiseActions(
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

const {setInitializing, setReady, setStopped}  = subscriptionActions(actionType => `@@test/${actionType}`)
dispatch(setReady())

// now state is {initializing: false, ready: true, stopped: false, error: null}
```

