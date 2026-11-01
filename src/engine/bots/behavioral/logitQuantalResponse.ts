import { LocalStrategy } from './behavioralStrategy'

export interface ExpectedUtility<Action> {
    action: Action
    utility: number
}

function softmax(logits: readonly number[]): number[] {
    if (logits.length === 0) return []

    const exps = logits.map((v) => Math.exp(v))
    const sum = exps.reduce((acc, e) => acc + e, 0)
    return exps.map((e) => e / sum)
}

export class LogitQuantalResponse<Action> extends LocalStrategy<Action> {
    readonly utilities: readonly ExpectedUtility<Action>[]

    constructor(
        utilities: readonly ExpectedUtility<Action>[],
        rationality: number,
    ) {
        if (utilities.length === 0) {
            super([])
            this.utilities = []
            return
        }

        const probabilities = softmax(
            utilities.map((u) => u.utility * rationality),
        )
        super(
            probabilities.map((probability, i) => ({
                probability,
                value: utilities[i].action,
            })),
        )
        this.utilities = utilities
    }
}
