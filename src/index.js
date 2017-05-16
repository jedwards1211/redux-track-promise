export const SET_PENDING = 'SET_PENDING'
export const RESOLVE = 'RESOLVE'
export const REJECT = 'REJECT'

export default function createReduxTrackPromise(customizeActionType = actionType => actionType) {
  const MY_SET_PENDING = customizeActionType(SET_PENDING)
  const MY_RESOLVE = customizeActionType(RESOLVE)
  const MY_REJECT = customizeActionType(REJECT)

  let currentPromise = null

  const setPending = (pending = true) => ({type: MY_SET_PENDING, payload: pending})
  const resolve = (result) => ({type: MY_RESOLVE, payload: result})
  const reject = (reason) => ({type: MY_REJECT, payload: reason, error: true})
  const track = (promise, dispatch) => {
    currentPromise = promise
    dispatch(setPending())
    return promise.then(
      value => { if (currentPromise === promise) dispatch(resolve(value)) },
      reason => {
        if (currentPromise === promise) {
          dispatch(reject(reason))
          throw reason
        }
      }
    )
  }
  const reducer = (state, action) => {
    const {type, payload} = action

    // ignore irrelevant actions
    // the && state check ensures that this will fall through and return the initial state if it's undefined
    if (type !== MY_SET_PENDING && type !== MY_RESOLVE && type !== MY_REJECT && state) return state

    return {
      pending: type === MY_SET_PENDING ? payload : false,
      fulfilled: type === MY_RESOLVE,
      rejected: type === MY_REJECT,
      value: type === MY_RESOLVE ? payload : null,
      reason: type === MY_REJECT ? payload : null,
    }
  }

  return {setPending, resolve, reject, track, reducer}
}

export const initialPromiseState = createReduxTrackPromise().reducer(undefined, {type: ''})

