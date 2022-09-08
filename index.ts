/*
 * @japa/spec-reporter
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { SpecReporterOptions } from './src/Contracts'
import { SpecReporter } from './src/Reporter'
export { SpecReporter }

/**
 * Spec reporter function
 */
export function specReporter(options: Partial<SpecReporterOptions> = {}) {
  const reporter = new SpecReporter(options)
  return reporter.boot.bind(reporter)
}
