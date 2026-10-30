import { ZERO_EPS } from './math'

export interface Sample<T> {
    value: T
    probability: number
}

export class SampleSpace<T> {
    protected samplePoints: Sample<T>[]

    // Initialize with all possibilities
    constructor(samples: Sample<T>[]) {
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
