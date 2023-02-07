/*
 * @japa/spec-reporter
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { SpecReporterOptions } from './src/types'
import { SpecReporter } from './src/reporter'
export { SpecReporter }

/**
 * Spec reporter function
 */
export function specReporter(options: Partial<SpecReporterOptions> = {}) {
  const reporter = new SpecReporter(options)
  return reporter.boot.bind(reporter)
}
