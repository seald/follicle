'use strict'

import { CamoError } from './errors'

export const deepTraverse = function (obj, func) {
  for (let i in obj) {
    func.apply(this, [i, obj[i], obj])
    if (obj[i] !== null && typeof (obj[i]) === 'object') {
      deepTraverse(obj[i], func)
    }
  }
}

export const migrateDocument = migrations => serializedDocument => {
  const finalVersion = migrations.length
  if (serializedDocument._version > finalVersion) throw new CamoError('Version of the database is too recent')
  while (serializedDocument._version < finalVersion) {
    serializedDocument = migrations[serializedDocument._version](serializedDocument)
    serializedDocument._version++
  }
  return serializedDocument
}
