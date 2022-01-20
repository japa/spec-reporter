import { Emitter, Runner } from '@japa/core'
import { fire } from '@japa/synthetic-events'
import { SpecReporter } from '../src/Reporter'

const emitter = new Emitter()
const reporter = new SpecReporter()
const runner = new Runner(emitter)

runner['boot']()
reporter.open(runner, emitter)

fire(emitter)
