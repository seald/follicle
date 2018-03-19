'use strict'

import { connect } from './lib/db'
import Document from './lib/document'
import EmbeddedDocument from './lib/embedded-document'
import { getClient } from './lib/clients'

export {connect, getClient, Document, EmbeddedDocument}
