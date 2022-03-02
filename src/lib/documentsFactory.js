import getBaseDocument from './base-document'
import getValidators from './validate'
import getEmbeddedDocument from './embedded-document'
import getDocument from './document'

/**
 * @param {DatabaseClient} client
 * @param {Object} migrations
 * @return {{validators: {isString, isNumber, isBoolean, isDate, isBuffer, isObject, isArray, isDocument, isEmbeddedDocument, isReferenceable, isNativeId, isSupportedType, isType, isValidType, isInChoices, isEmptyValue}, BaseDocument: BaseDocument, Document: Document, EmbeddedDocument: EmbeddedDocument}}
 * @constructor
 */
export const DocumentsFactory = (client, migrations) => {
  const classes = {}
  const validators = getValidators({ client, classes })
  classes.BaseDocument = getBaseDocument({ client, validators, classes })
  classes.Document = getDocument({ classes, client, validators, migrations })
  classes.EmbeddedDocument = getEmbeddedDocument({ classes, client, validators })

  return {
    client,
    validators,
    BaseDocument: classes.BaseDocument,
    Document: classes.Document,
    EmbeddedDocument: classes.EmbeddedDocument
  }
}
