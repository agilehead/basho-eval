import { Constants, BashoLogFn, ExpressionStackEntry } from "../types";
import { Seq } from "lazily-async";
import { PipelineItem, PipelineError, PipelineValue } from "../pipeline";
import { evalShorthand, evalWithCatch } from "../eval";
import { munch } from "../munch";
import { BashoEvalError } from "..";

export default async function terminate(
  args: string[],
  prevArgs: string[],
  constants: Constants,
  input: Seq<PipelineItem>,
  mustPrint: boolean,
  onLog: BashoLogFn,
  onWrite: BashoLogFn,
  isInitialInput: boolean,
  isFirstParam: boolean,
  expressionStack: Array<ExpressionStackEntry>
) {
  const { cursor, expression } = munch(args.slice(1));
  async function* asyncGenerator(): AsyncIterableIterator<PipelineItem> {
    const fn = await evalWithCatch(`(x, i) => (${expression})`, constants);
    let i = 0;
    for await (const x of input) {
      if (x instanceof PipelineValue) {
        const result = await fn(await x.value, i);
        if (result instanceof BashoEvalError) {
          return new PipelineError(
            `Failed to evaluate expression: ${expression}.`,
            result.error,
            x
          );
        }
        if (result === true) {
          return x;
        }
        yield x;
      } else {
        yield x;
      }
      i++;
    }
  }
  return await evalShorthand(
    args.slice(cursor + 1),
    args,
    constants,
    new Seq(asyncGenerator),
    mustPrint,
    onLog,
    onWrite,
    false,
    false,
    expressionStack
  );
}