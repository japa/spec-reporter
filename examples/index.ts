import { Emitter, Runner } from '@japa/core'
import { fire } from '@japa/synthetic-events'
import { specReporter } from '../index'

const emitter = new Emitter()
const runner = new Runner(emitter)

specReporter().handler(runner, emitter)
runner['boot']()

fire(emitter)
