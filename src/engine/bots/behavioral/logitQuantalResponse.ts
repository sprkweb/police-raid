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

export function logitQuantalResponse<Action>(
    utilities: readonly ExpectedUtility<Action>[],
    rationality: number,
): LocalStrategy<Action> {
    if (utilities.length === 0) return new LocalStrategy([])

    const probabilities = softmax(utilities.map((u) => u.utility * rationality))
    return new LocalStrategy(
        probabilities.map((probability, i) => ({
            probability,
            value: utilities[i].action,
        })),
    )
}
