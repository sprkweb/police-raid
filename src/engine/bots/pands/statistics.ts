/*!
 * Ported from PandSBot by Pavel Raliuk and Alex Paklonski. THE RESISTANCE
 * Competition, Vienna Game/AI Conference 2012. Original license: GNU General
 * Public License version 3.0 (GPL-3.0-only). Modified 2026-10-31: TypeScript
 * port; see README.md and LICENSE.GPL-3.0.
 */

export class Variable {
    total: number
    samples: number

    constructor(v0: number, n0: number) {
        this.total = v0
        this.samples = n0
    }

    sampleBool(value: boolean): void {
        this.sampleExt(Number(value), 1)
    }

    sampleExt(value: number, n: number): void {
        this.total += value
        this.samples += n
    }

    estimate(): number {
        return this.samples > 0 ? this.total / this.samples : 0
    }
}

/** Original heuristic accumulator, deliberately not a normalised posterior. */
export class Probability {
    value: number

    constructor(v0: number) {
        this.value = v0
    }

    sampleExt(value: number, n: number): void {
        this.value = 1 - (1 - this.value) * (1 - value / n)
    }

    estimate(): number {
        return this.value
    }
}
