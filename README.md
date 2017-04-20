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

## Quickstart

Let's say you want to track the status of some HTTPS requests your redux state.  Here's all it takes to set that up:

```js
import {createStore, combineReducers} from 'redux'
import createReduxTrackPromise from 'redux-track-promise'
import popsicle from 'popsicle'

const {track: trackLoginPromise, reducer: loginPromiseReducer} =
  createReduxTrackPromise(actionType => `LOGIN_PROMISE.${actionType}`)

const {track: trackSetPasswordPromise, reducer: setPasswordPromiseReducer} =
  createReduxTrackPromise(actionType => `SET_PASSWORD.${actionType}`)

const reducer = combineReducers({
  loginPromise: loginPromiseReducer,
  setPasswordPromise: setPasswordPromiseReducer,
})
const store = createStore(reducer)
```

Then whenever you make an HTTPS request, call one of your `track*Promise` functions to sync that promise into redux:

```js
trackLoginPromise(
  popsicle.post('/login', {username: 'jimbob', password: 'trump2024'}),
  store.dispatch
)
trackSetPasswordPromise(
  popsicle.post('/setPassword', {username: 'jimbob', oldPassword: 'trump2024', password: 'lordcuckifer'}),
  store.dispatch
)
```

Calling `trackLoginPromise` will dispatch a `LOGIN_PROMISE.SET_PENDING` that will update `state.loginPromise`.
Then later it will dispatch a `LOGIN_PROMISE.RESOLVE` or `LOGIN_PROMISE.REJECT` action, depending on whether the promise
gets resolved or rejected.

Likewise, `trackSetPasswordPromise` will dispatch `SET_PASSWORD_PROMISE.*` actions that update
`state.setPasswordPromise`.

Displaying the status of the requests is easy!  You can create a generic `PromiseStatus` component that
provides a consistent UI for anywhere in your app you're displaying the status of a promise:

```js
import React from 'react'
import {connect} from 'react-redux'

const PromiseStatus = messages => ({pending, fulfilled, rejected}) => {
  if (pending) return <div className="alert alert-info"><span className="spinner"> {messages.pending}</div>
  if (fulfilled) return <div className="alert alert-success">{messages.fulfilled}</div>
  if (rejected) return <div className="alert alert-danger">{messages.rejected} {reason.message}</div>
  return <span />
}
```

Then customize it, connect it to the promise state, and use it in your views like this:

```js
const LoginStatus = connect(state => state.loginPromise)(PromiseStatus({
  pending: 'Logging in...',
  fulfilled: 'Logged In',
  rejected: 'Login failed: ',
}))

const LoginView = connect(state => state.loginView)(({username, password, dispatch}) => (
  <form
      onSubmit={e => {
        e.preventDefault()
        trackLoginPromise(popsicle.post('/login', {username, password}), dispatch)
      }}
  >
    <LoginStatus />
    ...
  </form>
))

const SetPasswordStatus = connect(state => state.setPasswordPromise)(PromiseStatus({
  pending: 'Changing password...',
  fulfilled: 'Your password has been changed!',
  rejected: 'Failed to change your password',
}))

const SetPasswordView = connect(state => ({...state.changePasswordView, username: state.username}))(
  ({username, oldPassword, newPassword, repeatNewPassword}) => (
    <form
        onSubmit={e => {
          e.preventDefault()
          trackSetPasswordPromise(popsicle.post('/setPassword', {username, oldPassword, newPassword}), store.dispatch)
        }}
    >
      <SetPasswordStatus />
      ...
    </form>
  )
)
```

## What the state looks like

<table>
  <thead>
    <tr>
      <th>Initial (no promise)</th>
      <th>Pending</th>
      <th>Fulfilled</th>
      <th>Rejected</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <div class="highlight highlight-source-js"><pre>
{
  pending: false,
  fulfilled: false,
  rejected: false,
  value: null,
  reason: null,
}
        </pre></div>
      </td>
      <td>
        <div class="highlight highlight-source-js"><pre>
{
  pending: true,
  fulfilled: false,
  rejected: false,
  value: null,
  reason: null,
}
        </pre></div>
      </td>
      <td>
        <div class="highlight highlight-source-js"><pre>
{
  pending: false,
  fulfilled: true,
  rejected: false,
  value: {...},
  reason: null,
}
        </pre></div>
      </td>
      <td>
        <div class="highlight highlight-source-js"><pre>
{
  pending: false,
  fulfilled: false,
  rejected: true,
  value: null,
  reason: Error(...),
}
        </pre></div>
      </td>
    </tr>
  </tbody>
</table>

## Dispatching actions manually

```js
const {setPending, resolve, reject} = createReduxTrackPromise(actionType => `LOGIN_PROMISE.${actionType}`)

dispatch(setPending)
login(
  username, password,
  (error, result) => dispatch(error ? reject(error) : resolve(result))
)
```

(Of course, you could just use `es6-promisify` on a method that takes a callback and pass its promise to
`trackPromise`.  You may prefer to dispatch actions manually if your async operation involves more than a single
function call.)

## Resetting to initial, no promise state

You might want to hide any pending/resolved/rejected status in your UI altogether.
To do that, dispatch `setPending(false)`:

```js
const {setPending} = createReduxTrackPromise(...)
dispatch(setPending(false))
```

## How to rename all action types, action creators, and state fields

Let's say you want to track the state of a Meteor subscription.  Using this library makes total sense: `pending`
can mean the subscription is sending initial data, `fulfilled` can mean it's ready, and `rejected` can mean it stopped.
But what if you want the names of these fields and the action types to match Meteor terminology?

Here's how you could do it:

```js
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

dispatch(setReady())

// now state is {initializing: false, ready: true, stopped: false, error: null}
```

