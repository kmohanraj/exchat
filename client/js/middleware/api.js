import { camelizeKeys } from 'humps'
import 'isomorphic-fetch'
import { normalize } from 'normalizr'

import { API_CALL } from '../constants/ApiTypes'
import { UNKNOWN } from '../constants/ActionTypes'

function callApi(options) {
  let {path, method, data, schema, headers} = options
  let params = {
    method: method.toLowerCase(),
    headers: Object.assign({
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }, headers)
  }
  if (data) {
    params = {...params, body: JSON.stringify(data)}
  }
  return fetch('/api' + path, params)
    .then(response =>
      response.json().then(json => ({json, response}))
    ).then(({json, response}) => {
      if (!response.ok) {
        return Promise.reject({error: json, response})
      }

      let normalizedJson = camelizeKeys(json)
      if (schema) {
        normalizedJson = normalize(normalizedJson, schema)
      }

      return Object.assign({}, normalizedJson)
    })
}

export default store => next => action => {
  const apiCall = action[API_CALL]
  if (typeof apiCall === 'undefined') {
    return next(action)
  }

  function actionWith(params) {
    const finalAction = Object.assign({}, action, params)
    delete finalAction[API_CALL]
    return finalAction
  }

  let type = action.type || UNKNOWN

  let result = next(actionWith({type: type}))

  return callApi(apiCall).then(
    response => {
      next(actionWith({
        response,
        type: type + '_SUCCESS'
      }))
      if (apiCall.successCallback) {
        apiCall.successCallback(response, store)
      }
    },
    ({error, response}) => next(actionWith({
      type: type + '_FAILURE',
      error: error.message || 'Something bad happened',
      response
    }))
  )
}
