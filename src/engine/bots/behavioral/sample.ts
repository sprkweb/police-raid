import { ZERO_EPS } from './math'

export interface Sample<T> {
    value: T
    probability: number
}

export class SampleSpace<T> {
    readonly samplePoints: readonly Sample<T>[]

    // Initialize with all possibilities
    constructor(samples: readonly Sample<T>[]) {
        this.samplePoints = samples
    }

    /** P(F) is probability of condition F being true */
    probability(F: (s: T) => boolean): number {
        return this.samplePoints
            .filter((s) => F(s.value))
            .reduce((acc, s) => acc + s.probability, 0)
    }

    map(F: (s: Sample<T>) => Sample<T>): SampleSpace<T> {
        return new SampleSpace(this.samplePoints.map(F))
    }

    count(): number {
        return this.samplePoints.length
    }

    // Return this sample space where impossible sample points are removed
    // and the others are adjusted so that the sum is 1
    normalize(): SampleSpace<T> {
        let newSamplePoints = this.samplePoints.filter(
            (h) => h.probability > ZERO_EPS,
        )

        const sum = newSamplePoints.reduce((acc, h) => acc + h.probability, 0)
        if (newSamplePoints.length === 0 || sum <= ZERO_EPS) {
            // no more samples with positive probability left
            return new SampleSpace([])
        }

        newSamplePoints = newSamplePoints.map((h) => ({
            ...h,
            probability: h.probability / sum,
        }))
        return new SampleSpace(newSamplePoints)
    }
}

/** Unnormalized evidence retained in log space across successive updates. */
export class LogSampleSpace<T> {
    private readonly samples: readonly { value: T; logWeight: number }[]

    constructor(samples: readonly { value: T; logWeight: number }[]) {
        this.samples = samples
    }

    static from<T>(space: SampleSpace<T>): LogSampleSpace<T> {
        return new LogSampleSpace(
            space.samplePoints.map(({ value, probability }) => ({
                value,
                logWeight: Math.log(probability),
            })),
        )
    }

    condition(predicate: (value: T) => boolean): LogSampleSpace<T> {
        return new LogSampleSpace(
            this.samples.filter(({ value }) => predicate(value)),
        )
    }

    bayesianInference(likelihood: (value: T) => number): LogSampleSpace<T> {
        return new LogSampleSpace(
            this.samples.map(({ value, logWeight }) => ({
                value,
                logWeight: logWeight + Math.log(likelihood(value)),
            })),
        )
    }

    normalize(): SampleSpace<T> {
        if (!this.samples.length) return new SampleSpace([])
        const max = Math.max(...this.samples.map(({ logWeight }) => logWeight))
        if (!Number.isFinite(max)) {
            throw new Error(
                'Cannot normalize log weights without finite positive mass.',
            )
        }
        const masses = this.samples.map(({ logWeight }) =>
            Math.exp(logWeight - max),
        )
        const sum = masses.reduce((a, b) => a + b, 0)
        // Do not EPS-prune component masses: pooling must retain their fixed weight.
        return new SampleSpace(
            this.samples.map(({ value }, i) => ({
                value,
                probability: masses[i] / sum,
            })),
        )
    }
}
