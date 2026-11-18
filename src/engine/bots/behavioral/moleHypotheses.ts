import type { PlayerId } from '../../../types/game'
import { combinations } from './math'
import { SampleSpace } from './sample'

// MoleHypothesisSpace is a hypotheses space
// where each hypothesis is a possible team of moles
export class MoleHypothesisSpace {
    // Hypotheses about who are the moles
    // Each hypothesis is an array of moles PlayerId[]
    moleHypotheses: SampleSpace<PlayerId[]>

    // Initialize with all possible hypotheses
    constructor(moleHypotheses: SampleSpace<PlayerId[]>) {
        this.moleHypotheses = moleHypotheses
    }

    // Initialize with all possible hypotheses for given players and moleCount
    static forPlayers(
        playerIds: readonly PlayerId[],
        moleCount: number,
    ): MoleHypothesisSpace {
        const moleCombinations = combinations(playerIds, moleCount)
        if (moleCombinations.length === 0) {
            return new this(new SampleSpace([]))
        }

        const probability = 1 / moleCombinations.length
        const hypotheses = moleCombinations.map((moles) => ({
            value: moles,
            probability,
        }))
        return new this(new SampleSpace(hypotheses))
    }

    /** P(F) is probability of condition F being true */
    probability(F: (H: readonly PlayerId[]) => boolean): number {
        return this.moleHypotheses.probability(F)
    }

    count(): number {
        return this.moleHypotheses.count()
    }

    // TODO: test this
    /**
     * Return hypothesis space where the probability of hypotheses H are updated
     * after an event E using likelihood function P(E | H)
     */
    bayesianInference(
        likelihood: (h: readonly PlayerId[]) => number,
    ): MoleHypothesisSpace {
        return new MoleHypothesisSpace(
            this.moleHypotheses
                .map((h) => ({
                    ...h,
                    probability: h.probability * likelihood(h.value),
                }))
                .normalize(),
        )
    }
}
