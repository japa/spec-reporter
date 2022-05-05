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
import { ErrorsPrinter } from '@japa/errors-printer'
import type { SpecReporterOptions } from '../Contracts'
import type { Emitter, Runner, GroupStartNode, TestEndNode } from '@japa/core'

/**
 * Pretty prints the tests on the console
 */
export class SpecReporter {
  private options: SpecReporterOptions
  private currentSuiteName?: string
  private currentFileName?: string
  private currentGroupTitle?: string
  private currentTestTitle?: string
  private groupPayload?: GroupStartNode
  private uncaughtExceptions: { phase: 'test'; error: Error }[] = []

  constructor(options: Partial<SpecReporterOptions> = {}) {
    this.options = {
      stackLinesCount: options.stackLinesCount || 5,
    }
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
    const indentation = this.currentFileName || this.currentGroupTitle ? '  ' : ''
    const duration = logger.colors.dim(`(${ms(payload.duration)})`)
    const retries =
      payload.retryAttempt && payload.retryAttempt > 1
        ? logger.colors.dim(`(x${payload.retryAttempt}) `)
        : ''

    let subText = this.getSubText(payload)
    subText = subText ? `\n${indentation}  ${subText}` : ''

    console.log(`${indentation}${icon} ${retries}${message} ${duration}${subText}`)
  }

  /**
   * Prints the group name
   */
  private printGroup(payload: GroupStartNode) {
    this.currentFileName = payload.meta.fileName
    this.currentGroupTitle = payload.title

    const title =
      this.currentSuiteName !== 'default'
        ? `${this.currentSuiteName} / ${payload.title}`
        : payload.title

    const suffix = this.currentFileName
      ? logger.colors.dim(` (${this.getRelativeFilename(this.currentFileName)})`)
      : ''

    console.log(`\n${title}${suffix}`)
  }

  /**
   * Print the aggregate count
   */
  private printAggregate(label: string, count: number, whitespaceLength: number) {
    if (count) {
      console.log(logger.colors.dim(`${label.padEnd(whitespaceLength + 2)} : ${count}`))
    }
  }

  /**
   * Print tests summary
   */
  private async printSummary(summary: ReturnType<Runner<any>['getSummary']>) {
    console.log('')

    if (summary.aggregates.total === 0) {
      console.log(logger.colors.bgYellow().black(' NO TESTS EXECUTED '))
      return
    }

    if (summary.hasError) {
      console.log(logger.colors.bgRed().black(' FAILED '))
    } else {
      console.log(logger.colors.bgGreen().black(' PASSED '))
    }
    console.log('')

    const aggregatesWhiteSpace = summary.aggregates.uncaughtExceptions ? 19 : 10

    this.printAggregate('total', summary.aggregates.total, aggregatesWhiteSpace)
    this.printAggregate('failed', summary.aggregates.failed, aggregatesWhiteSpace)
    this.printAggregate('passed', summary.aggregates.passed, aggregatesWhiteSpace)
    this.printAggregate('todo', summary.aggregates.todo, aggregatesWhiteSpace)
    this.printAggregate('skipped', summary.aggregates.skipped, aggregatesWhiteSpace)
    this.printAggregate('regression', summary.aggregates.regression, aggregatesWhiteSpace)
    this.printAggregate(
      'uncaught exceptions',
      summary.aggregates.uncaughtExceptions,
      aggregatesWhiteSpace
    )
    this.printAggregate('duration', ms(summary.duration), aggregatesWhiteSpace)

    if (summary.failureTree.length || this.uncaughtExceptions.length) {
      console.log('')
      console.log('')
    }

    const errorPrinter = new ErrorsPrinter({
      stackLinesCount: this.options.stackLinesCount,
    })

    /**
     * Printing the errors tree
     */
    for (let suite of summary.failureTree) {
      await errorPrinter.printErrors(suite.name, suite.errors)

      for (let testOrGroup of suite.children) {
        if (testOrGroup.type === 'group') {
          await errorPrinter.printErrors(testOrGroup.name, testOrGroup.errors)
          for (let test of testOrGroup.children) {
            await errorPrinter.printErrors(test.title, test.errors)
          }
        } else {
          await errorPrinter.printErrors(testOrGroup.title, testOrGroup.errors)
        }
      }
    }

    /**
     * Uncaught exceptions
     */
    await errorPrinter.printErrors('Uncaught exception', this.uncaughtExceptions)
  }

  /**
   * Invoked by the tests runner when tests are about to start
   */
  public open(runner: Runner<any>, emitter: Emitter) {
    emitter.on('test:start', (payload) => {
      this.currentFileName = payload.meta.fileName

      /**
       * Print the group title
       */
      if (this.groupPayload) {
        this.printGroup(this.groupPayload)
        this.groupPayload = undefined
      }

      /**
       * Display the filename when
       *
       * - The filename exists
       * - The test is not under a group
       * - Test is first in a sequence
       */
      if (payload.meta.fileName && !this.currentGroupTitle && !this.currentTestTitle) {
        console.log(`\n${logger.colors.dim(this.getRelativeFilename(this.currentFileName!))}`)
      }

      this.currentTestTitle =
        typeof payload.title === 'string' ? payload.title : payload.title.expanded
    })

    emitter.on('test:end', (payload) => {
      this.printTest(payload)
      this.currentTestTitle = undefined
    })

    emitter.on('group:start', (payload) => {
      this.groupPayload = payload
    })

    emitter.on('group:end', () => {
      this.currentGroupTitle = undefined
      this.groupPayload = undefined
    })

    emitter.on('suite:start', (payload) => {
      this.currentSuiteName = payload.name
    })

    emitter.on('suite:end', () => {
      this.currentSuiteName = undefined
    })

    emitter.on('uncaught:exception', async (error) => {
      this.uncaughtExceptions.push({ phase: 'test', error })
    })

    emitter.on('runner:end', async () => {
      const summary = runner.getSummary()
      await this.printSummary(summary)
    })
  }
}
