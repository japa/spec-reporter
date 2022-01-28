/*
 * @japa/spec-reporter
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ms from 'ms'
import { pope } from 'pope'
import { icons, logger } from '@poppinss/cliui'
import { ErrorsPrinter } from '@japa/errors-printer'
import { Emitter, Runner, GroupStartNode, TestEndNode } from '@japa/core'

/**
 * Pretty prints the tests on the console
 */
export class SpecReporter {
  private currentSuiteTitle?: string
  private currentGroupTitle?: string

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
    const message = pope(payload.title, payload)

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
   * Prints the test details
   */
  private printTest(payload: TestEndNode) {
    const icon = this.getTestIcon(payload)
    const message = this.getTestMessage(payload)
    const indentation = this.currentGroupTitle ? '  ' : ''
    const duration = logger.colors.dim(`(${ms(payload.duration)})`)

    let subText = this.getSubText(payload)
    subText = subText ? `\n${indentation}   ${subText}` : ''

    console.log(`${indentation}${icon}  ${message} ${duration}${subText}`)
  }

  /**
   * Prints the group name
   */
  private printGroup(payload: GroupStartNode) {
    this.currentGroupTitle = payload.title

    const title =
      this.currentSuiteTitle !== 'default'
        ? `${this.currentSuiteTitle} / ${payload.title}`
        : payload.title

    console.log(`\n${title}`)
  }

  /**
   * Print the aggregate count
   */
  private printAggregate(label: string, count: number) {
    if (count) {
      console.log(logger.colors.dim(`${label.padEnd(13)} : ${count}`))
    }
  }

  /**
   * Print tests summary
   */
  private async printSummary(summary: ReturnType<Runner['getSummary']>) {
    console.log('')

    if (summary.hasError) {
      console.log(logger.colors.bgRed().white(' FAILED '))
    } else {
      console.log(logger.colors.bgGreen().white(' PASSED '))
    }
    console.log('')

    this.printAggregate('total', summary.total)
    this.printAggregate('failed', summary.failed)
    this.printAggregate('passed', summary.passed)
    this.printAggregate('todo', summary.todo)
    this.printAggregate('skipped', summary.skipped)
    this.printAggregate('regression', summary.regression)
    this.printAggregate('duration', ms(summary.duration))

    console.log('')
    console.log('')

    const errorPrinter = new ErrorsPrinter()

    /**
     * Tests runner errors
     */
    await errorPrinter.printErrors('Tests Runner', summary.runnerErrors)

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
  }

  /**
   * Invoked by the tests runner when tests are about to start
   */
  public open(runner: Runner, emitter: Emitter) {
    emitter.on('test:end', (payload) => this.printTest(payload))
    emitter.on('group:start', (payload) => this.printGroup(payload))
    emitter.on('group:end', () => (this.currentGroupTitle = undefined))
    emitter.on('suite:start', (payload) => {
      this.currentSuiteTitle = payload.name
    })
    emitter.on('suite:end', () => (this.currentSuiteTitle = undefined))
    emitter.on('runner:end', () => {
      const summary = runner.getSummary()
      this.printSummary(summary)
    })
  }

  /**
   * Invoked by the tests runner when tests have finished
   */
  public close() {}
}
