/*
 * @japa/spec-reporter
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ms from 'ms'
import { relative } from 'path'
import { icons, logger } from '@poppinss/cliui'
import { BaseReporter } from '@japa/base-reporter'
import type { GroupStartNode, TestEndNode } from '@japa/core'

import type { SpecReporterOptions } from '../Contracts'

/**
 * Pretty prints the tests on the console
 */
export class SpecReporter extends BaseReporter {
  /**
   * Tracking the current test title and group title. We
   * need to adjust how we indent text and display
   * information
   */
  private currentGroupTitle?: string
  private isFirstLoneTest = true

  constructor(options: Partial<SpecReporterOptions> = {}) {
    super(options)
  }

  /**
   * Returns the icon for the test
   */
  private getTestIcon(payload: TestEndNode) {
    if (payload.isTodo) {
      return logger.colors.cyan(icons.info)
    }

    if (payload.isFailing) {
      return payload.hasError
        ? logger.colors.magenta(icons.squareSmallFilled)
        : logger.colors.red(icons.cross)
    }

    if (payload.hasError) {
      return logger.colors.red(icons.cross)
    }

    if (payload.isSkipped) {
      return logger.colors.yellow(icons.bullet)
    }

    return logger.colors.green(icons.tick)
  }

  /**
   * Returns the test message
   */
  private getTestMessage(payload: TestEndNode) {
    const message = typeof payload.title === 'string' ? payload.title : payload.title.expanded

    if (payload.isTodo) {
      return logger.colors.blue(message)
    }

    if (payload.isFailing) {
      return payload.hasError ? logger.colors.magenta(message) : logger.colors.red(message)
    }

    if (payload.hasError) {
      return logger.colors.red(message)
    }

    if (payload.isSkipped) {
      return logger.colors.yellow(message)
    }

    return logger.colors.grey(message)
  }

  /**
   * Returns the subtext message for the test
   */
  private getSubText(payload: TestEndNode): string | undefined {
    if (payload.isSkipped && payload.skipReason) {
      return logger.colors.yellow(payload.skipReason)
    }

    if (!payload.isFailing) {
      return
    }

    if (!payload.hasError) {
      return logger.colors.magenta(`Test marked with ".fails()" must finish with an error`)
    }

    if (payload.failReason) {
      return logger.colors.magenta(payload.failReason)
    }

    const testErrorMessage = payload.errors.find((error) => error.phase === 'test')
    if (testErrorMessage && testErrorMessage.error) {
      return logger.colors.magenta(testErrorMessage.error.message)
    }
  }

  /**
   * Returns the filename relative from the current working dir
   */
  private getRelativeFilename(fileName: string) {
    return relative(process.cwd(), fileName)
  }

  /**
   * Prints the test details
   */
  private printTest(payload: TestEndNode) {
    const icon = this.getTestIcon(payload)
    const message = this.getTestMessage(payload)
    const prefix = payload.isPinned ? logger.colors.yellow('[PINNED] ') : ''
    const indentation = this.currentFileName || this.currentGroupTitle ? '  ' : ''
    const duration = logger.colors.dim(`(${ms(payload.duration)})`)
    const retries =
      payload.retryAttempt && payload.retryAttempt > 1
        ? logger.colors.dim(`(x${payload.retryAttempt}) `)
        : ''

    let subText = this.getSubText(payload)
    subText = subText ? `\n${indentation}  ${subText}` : ''

    console.log(`${indentation}${icon} ${prefix}${retries}${message} ${duration}${subText}`)
  }

  /**
   * Prints the group name
   */
  private printGroup(payload: GroupStartNode) {
    const title =
      this.currentSuiteName !== 'default'
        ? `${this.currentSuiteName} / ${payload.title}`
        : payload.title

    const suffix = this.currentFileName
      ? logger.colors.dim(` (${this.getRelativeFilename(this.currentFileName)})`)
      : ''

    console.log(`\n${title}${suffix}`)
  }

  protected onTestStart(): void {
    /**
     * Display the filename when
     *
     * - The filename exists
     * - The test is not under a group
     * - Test is first in a sequence
     */
    if (this.currentFileName && this.isFirstLoneTest) {
      console.log(`\n${logger.colors.dim(this.getRelativeFilename(this.currentFileName))}`)
    }

    this.isFirstLoneTest = false
  }

  protected onTestEnd(payload: TestEndNode): void {
    this.printTest(payload)
  }

  protected onGroupStart(payload: GroupStartNode): void {
    /**
     * When a group starts, we mark the upcoming test as NOT a
     * lone test
     */
    this.isFirstLoneTest = false
    this.currentGroupTitle = payload.title
    this.printGroup(payload)
  }

  protected onGroupEnd(): void {
    this.currentGroupTitle = undefined

    /**
     * When the group ends we assume that the next test can
     * be out of the group, hence a lone test.
     *
     * If this assumption is false, then the `onGroupStart` method
     * will toggle the boolean
     */
    this.isFirstLoneTest = true
  }

  protected async end() {
    const summary = this.runner.getSummary()
    await this.printSummary(summary)
  }
}
