import { describe, expect, it } from 'vitest'

import { Role, type GameEvent } from '../../../../types/game'
import { LocalStrategy, type BehavioralStrategy } from '../behavioralStrategy'
import { Level0Estimator } from '../level0'
import { LevelKPlus1Estimator, MoleHypothesesFromHistory } from '../levelKPlus1'
import { LogitBehavioralStrategy } from '../logitQuantalResponse'
import { proposeCtx, voteCtx } from './fixtures'

const proposal: GameEvent = {
    kind: 'proposal',
    proposerId: 'A',
    team: ['A', 'B'],
}
const raid = (sabotageCount: number, team = ['A', 'B']): GameEvent => ({
    kind: 'raid',
    sabotageCount,
    team,
    proposerId: 'C',
    round: 1,
})

// Deliberately controlled evidence: the observed proposal is four times more
// likely if A is a mole; raid actions remain fair coins.
function model(neutral = false, tiny = false): BehavioralStrategy {
    return {
        strategyForTeamProposal(ctx) {
            const p = tiny
                ? 0.0001
                : neutral
                  ? 0.5
                  : ctx.moleIds.includes('A')
                    ? 0.8
                    : 0.2
            return new LocalStrategy([
                { value: ctx.playerIds.slice(0, ctx.teamSize), probability: p },
                { value: ['D', 'E'], probability: 1 - p },
            ])
        },
        strategyForTeamVote() {
            return new LocalStrategy([
                { value: 'Approve', probability: 0.5 },
                { value: 'Reject', probability: 0.5 },
            ])
        },
        strategyForRaidAction() {
            return new LocalStrategy([
                { value: 'Support', probability: 0.5 },
                { value: 'Sabotage', probability: 0.5 },
            ])
        },
    }
}

function actorBelief(history: readonly GameEvent[], strategy = model()) {
    const ctx = proposeCtx({ history })
    return new MoleHypothesesFromHistory(strategy).getForActor(ctx)
}

describe('raid / all-event history mixture', () => {
    it('conditions each component before pooling despite unequal actor masses', () => {
        // Six actor-innocent hypotheses: three contain A. QR(A)=1/2,
        // Qall(A)=4/5. Common Qall has a different mass on C-innocent rows.
        const q = actorBelief([proposal])
        expect(q.probability((h) => h.includes('A'))).toBeCloseTo(0.59, 12)
        expect(q.probability((h) => h.includes('C'))).toBe(0)
        expect(q.probability(() => true)).toBeCloseTo(1, 12)
        const estimator = new LevelKPlus1Estimator(
            new MoleHypothesesFromHistory(model()),
        )
        const ctx = proposeCtx({ history: [proposal], teamSize: 1 })
        expect(
            estimator
                .estimateProposedTeam(ctx)
                .find(({ action }) => action[0] === 'A')!.utility,
        ).toBeCloseTo(0.82, 12)
        expect(
            estimator.estimateTeamVote(
                voteCtx({ ...ctx, proposedTeam: ['A'] }),
            ),
        ).toEqual([
            { action: 'Approve', utility: expect.closeTo(0.41) },
            { action: 'Reject', utility: expect.closeTo(0.59) },
        ])
    })

    it('accumulates original likelihoods without feeding pooled probabilities back', () => {
        const history = new MoleHypothesesFromHistory(model())
        const first = history.getForActor(proposeCtx({ history: [proposal] }))
        expect(first.probability((h) => h.includes('A'))).toBeCloseTo(0.59, 12)
        const ctx = proposeCtx({ history: [proposal, proposal] })
        const second = history.getForActor(ctx)
        // Qall(A)=16/17, QR(A)=1/2 after two four-to-one observations.
        expect(second.probability((h) => h.includes('A'))).toBeCloseTo(
            0.6323529411764706,
            12,
        )
        expect(history.getForActor(ctx).moleHypotheses.samplePoints).toEqual(
            second.moleHypotheses.samplePoints,
        )
        expect(second.moleHypotheses.samplePoints).toEqual(
            actorBelief(ctx.history).moleHypotheses.samplePoints,
        )
    })

    it('preserves the raid-only floor under overwhelming behavioral evidence', () => {
        const q = actorBelief(Array.from({ length: 20 }, () => proposal))
        // Behavioral evidence can move only 30% of mass; each of the three
        // A-free hypotheses retains its 70% share of the uniform raid prior.
        for (const row of q.moleHypotheses.samplePoints.filter(
            (p) => !p.value.includes('A'),
        )) {
            expect(row.probability).toBeCloseTo(7 / 60, 10)
        }
        expect(q.probability((h) => h.includes('A'))).toBeCloseTo(0.65, 10)
    })

    it('keeps neutral behavior and absent behavior identical to raid evidence alone', () => {
        const raids = [raid(0), raid(1)]
        const baseline = actorBelief(raids, model(true))
        const neutral = actorBelief(
            [proposal, raids[0], proposal, raids[1]],
            model(true),
        )
        for (const row of baseline.moleHypotheses.samplePoints) {
            expect(
                neutral.probability((h) => h.join() === row.value.join()),
            ).toBeCloseTo(row.probability, 12)
        }
        expect(
            neutral.probability((h) => h.includes('A') && h.includes('B')),
        ).toBeCloseTo(1 / 9)
        expect(
            neutral.probability((h) => !h.includes('A') && !h.includes('B')),
        ).toBe(0)
    })

    it('applies physical exclusions to both components and keeps the native empty-actor fallback', () => {
        const ctx = proposeCtx({
            actorId: 'A',
            role: Role.Mole,
            history: [proposal, raid(2)],
        })
        const history = new MoleHypothesesFromHistory(model())
        expect(history.get(ctx).probability((h) => h.join() === 'A,B')).toBe(1)
        expect(history.getForActor(ctx).count()).toBe(0)
        const estimator = new LevelKPlus1Estimator(history)
        const baseline = new Level0Estimator()
        expect(estimator.estimateProposedTeam(ctx)).toEqual(
            baseline.estimateProposedTeam(ctx),
        )
        expect(estimator.estimateTeamVote(voteCtx(ctx))).toEqual(
            baseline.estimateTeamVote(voteCtx(ctx)),
        )
    })

    it('does not use private mole identities to form public beliefs', () => {
        const ctx = proposeCtx({
            role: Role.Mole,
            history: [proposal, raid(1)],
        })
        const a = new MoleHypothesesFromHistory(model()).getForActor(ctx)
        const b = new MoleHypothesesFromHistory(model()).getForActor({
            ...ctx,
            moleIds: ['D', 'E'],
        })
        expect(a.moleHypotheses.samplePoints).toEqual(
            b.moleHypotheses.samplePoints,
        )
    })

    it('retains normalized beliefs through a long legal sequence with tiny neutral likelihoods', () => {
        // Four rounds with four rejected proposals then approval, followed by
        // four rejections in round five: legal 5-player history at score 2:2.
        const events: GameEvent[] = []
        for (let round = 1; round <= 5; round++) {
            const team =
                round === 1 || round === 3 ? ['A', 'B'] : ['A', 'B', 'C']
            for (
                let rejection = 0;
                rejection < (round === 5 ? 4 : 5);
                rejection++
            ) {
                events.push(
                    { ...proposal, team },
                    {
                        kind: 'votes',
                        team,
                        consecutiveRejections: rejection,
                        votes: Object.fromEntries(
                            ['A', 'B', 'C', 'D', 'E'].map((id) => [
                                id,
                                rejection === 4 ? 'Approve' : 'Reject',
                            ]),
                        ),
                    },
                )
            }
            if (round < 5)
                events.push({ ...raid(round % 2, team), round } as GameEvent)
        }
        const full = actorBelief(events, model(true, true))
        const raids = actorBelief(
            events.filter((e) => e.kind === 'raid'),
            model(true),
        )
        expect(full.count()).toBe(5)
        expect(full.probability(() => true)).toBeCloseTo(1, 12)
        for (const row of raids.moleHypotheses.samplePoints) {
            expect(
                full.probability((h) => h.join() === row.value.join()),
            ).toBeCloseTo(row.probability, 12)
        }
    })

    it('uses historical terminal scores for raid likelihoods, including threshold two', () => {
        const strategy = new LogitBehavioralStrategy(2.5, new Level0Estimator())
        // At the first raid score is 0:0 even though current score is 2:0.
        const early = actorBelief(
            [raid(0, ['A']), raid(0, []), raid(0, [])],
            strategy,
        )
        const late = actorBelief(
            [raid(0, []), raid(0, []), raid(0, ['A'])],
            strategy,
        )
        expect(early.probability((h) => h.includes('A'))).toBeCloseTo(
            0.035979,
            5,
        )
        expect(late.probability((h) => h.includes('A'))).toBeCloseTo(
            0.00850454,
            6,
        )
        // Seven players: round four needs two sabotages. A+B is exactly
        // enough only if both are moles. A clean raid weighs that possibility
        // by two terminal support probabilities, while no-mole teams have likelihood 1.
        const history = [raid(0, []), raid(0, []), raid(1, ['D']), raid(0)]
        const ctx = proposeCtx({
            playerIds: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            moleIds: ['A', 'B', 'D'],
            history,
        })
        const q = new MoleHypothesesFromHistory(strategy).getForActor(ctx)
        expect(q.count()).toBe(10)
        expect(
            q.probability((h) => h.join() === 'A,B,D') /
                q.probability((h) => h.join() === 'D,E,F'),
        ).toBeCloseTo(0.000073573256, 9)
    })
})
