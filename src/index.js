export const SET_PENDING = 'SET_PENDING'
export const RESOLVE = 'RESOLVE'
export const REJECT = 'REJECT'

export function promiseActionCreators(customizeActionType = actionType => actionType) {
  const MY_SET_PENDING = customizeActionType(SET_PENDING)
  const MY_RESOLVE = customizeActionType(RESOLVE)
  const MY_REJECT = customizeActionType(REJECT)

  return {
    setPending: (pending = true) => ({type: MY_SET_PENDING, payload: pending}),
    resolve: (result) => ({type: MY_RESOLVE, payload: result}),
    reject: (reason) => ({type: MY_REJECT, payload: reason, error: true}),
  }
}

export function promiseReducer(actionCreators = promiseActionCreators()) {
  const MY_SET_PENDING = actionCreators.setPending().type
  const MY_RESOLVE = actionCreators.resolve().type
  const MY_REJECT = actionCreators.reject().type

  return function scopedPromiseReducer(state, action) {
    const {type, payload} = action

    // ignore irrelevant actions
    if (type !== MY_SET_PENDING && type !== MY_RESOLVE && type !== MY_REJECT && state) return state

    return {
      pending: type === MY_SET_PENDING ? payload : false,
      fulfilled: type === MY_RESOLVE,
      rejected: type === MY_REJECT,
      value: type === MY_RESOLVE ? payload : null,
      reason: type === MY_REJECT ? payload : null,
    }
  }
}

// didn't feel like making redux a peer dependency
function bindActionCreators({setPending, resolve, reject}, dispatch) {
  return {
    setPending: (pending) => dispatch(setPending(pending)),
    resolve: (result) => dispatch(resolve(result)),
    reject: (reason) => dispatch(reject(reason)),
  }
}

export function trackPromise(promise, {dispatch, actionCreators}) {
  // bind the action creators to dispatch if given; otherwise assume they're already bound
  const {setPending, resolve, reject} = dispatch ? bindActionCreators(actionCreators, dispatch) : actionCreators
  setPending()
  let canceled = false
  promise.then(
    value => canceled || resolve(value),
    reason => canceled || reject(reason)
  )
  return {
    cancel: () => canceled = true,
  }
}

export function createPromiseTracker({dispatch, actionCreators, ignoreOldPromises}) {
  let lastResult
  return (promise, options = {}) => {
    if (ignoreOldPromises && lastResult) lastResult.cancel()
    return lastResult = trackPromise(promise, {
      dispatch: options.dispatch || dispatch,
      actionCreators: options.actionCreators || actionCreators,
    })
  }
}

