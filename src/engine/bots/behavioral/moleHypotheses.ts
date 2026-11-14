import type { PlayerId } from '../../../types/game'
import { combinations } from './math'
import { LogSampleSpace, SampleSpace } from './sample'

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

/**
 * Independent raid-only and full-evidence posteriors, pooled after
 * conditioning.
 */
export class MoleHypothesisEvidence {
    private raidEvidence: LogSampleSpace<PlayerId[]>
    private allEvidence: LogSampleSpace<PlayerId[]>

    private constructor(prior: LogSampleSpace<PlayerId[]>) {
        this.raidEvidence = prior
        this.allEvidence = prior
    }

    static forPlayers(
        playerIds: readonly PlayerId[],
        moleCount: number,
    ): MoleHypothesisEvidence {
        const prior = LogSampleSpace.from(
            MoleHypothesisSpace.forPlayers(playerIds, moleCount).moleHypotheses,
        )
        return new MoleHypothesisEvidence(prior)
    }

    observe(
        likelihood: (moles: readonly PlayerId[]) => number,
        isRaid: boolean,
        possible: (moles: readonly PlayerId[]) => boolean,
    ): void {
        // Physical exclusions apply to both channels and never recover.
        this.raidEvidence = this.raidEvidence.condition(possible)
        this.allEvidence = this.allEvidence.condition(possible)
        // Evaluate once per hypothesis, as both channels use the same likelihood.
        const likelihoods = new Map<PlayerId[], number>()
        const cachedLikelihood = (moles: PlayerId[]) => {
            let value = likelihoods.get(moles)
            if (value === undefined) {
                value = likelihood(moles)
                likelihoods.set(moles, value)
            }
            return value
        }
        this.allEvidence = this.allEvidence.bayesianInference(cachedLikelihood)
        if (isRaid)
            this.raidEvidence =
                this.raidEvidence.bayesianInference(cachedLikelihood)
    }

    distribution(actorId?: PlayerId): MoleHypothesisSpace {
        const innocent = (moles: PlayerId[]) =>
            actorId === undefined || !moles.includes(actorId)
        const raid = this.raidEvidence.condition(innocent).normalize()
        const all = this.allEvidence.condition(innocent).normalize()
        // Both channels retain the same hypotheses in the same order. Mix only
        // their normalized distributions; never feed the pool back into evidence.
        return new MoleHypothesisSpace(
            new SampleSpace(
                raid.samplePoints.map(({ value, probability }, i) => ({
                    value,
                    probability:
                        0.7 * probability +
                        0.3 * all.samplePoints[i].probability,
                })),
            ),
        )
    }
}
