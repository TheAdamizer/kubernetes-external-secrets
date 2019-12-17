'use strict'

/* eslint-disable no-process-env */
const AWS = require('aws-sdk')
const clonedeep = require('lodash.clonedeep')
const merge = require('lodash.merge')

const localstack = process.env.LOCALSTACK || 0
const useOIDC = 'OIDC_ENABLED' in process.env

let secretsManagerConfig = {}
let systemManagerConfig = {}
let stsConfig = {}
let webIdentityToken = ''
let providerId = ''

if (localstack) {
  secretsManagerConfig = {
    endpoint: process.env.LOCALSTACK_SM_URL || 'http://localhost:4584',
    region: process.env.AWS_REGION || 'us-west-2'
  }
  systemManagerConfig = {
    endpoint: process.env.LOCALSTACK_SSM_URL || 'http://localhost:4583',
    region: process.env.AWS_REGION || 'us-west-2'
  }
  stsConfig = {
    endpoint: process.env.LOCALSTACK_STS_URL || 'http://localhost:4592',
    region: process.env.AWS_REGION || 'us-west-2'
  }
}

if (useOIDC) {
  const fs = require('fs')
  webIdentityToken = fs.readFileSync(
    process.env[AWS_WEB_IDENTITY_TOKEN_FILE] ||
    '/var/run/secrets/eks.amazonaws.com/serviceaccount/token'
  )
  providerId = process.env[AWS_PROVIDER_ID] || 'www.amazon.com'
}

module.exports = {
  secretsManagerFactory: (opts = {}) => {
    if (localstack) {
      opts = merge(clonedeep(opts), secretsManagerConfig)
    }
    return new AWS.SecretsManager(opts)
  },
  systemManagerFactory: (opts = {}) => {
    if (localstack) {
      opts = merge(clonedeep(opts), systemManagerConfig)
    }
    return new AWS.SSM(opts)
  },
  assumeRole: (assumeRoleOpts) => {
    const sts = new AWS.STS(stsConfig)
    let _assumeRole = sts.assumeRole
    let options = assumeRoleOpts

    if (useOIDC) {
      _assumeRole = sts.assumeRoleWithWebIdentity
      options = {
        ...assumeRoleOpts,
        ProviderId: providerId,
        WebIdentityToken: webIdentityToken
      }
    }
    return new Promise((resolve, reject) => {
      _assumeRole(options, (err, res) => {
        if (err) {
          return reject(err)
        }
        resolve(res)
      })
    })
  }
}
