import { describe, expect, it } from 'vitest'

import { PandSModel } from '../model'

describe('PandS suspicion model', () => {
    it('reproduces the original pair formula and individual suspicion', () => {
        const model = new PandSModel(5, 2)
        model.suspects[1].sampleExt(1, 2)
        model.suspects[2].sampleExt(3, 4)
        model.suspeciousActions[1].sampleExt(1, 2)
        model.suspeciousActions[2].sampleExt(1, 4)
        model.possibleGoodActions[1].sampleExt(1, 4)
        model.possibleGoodActions[2].sampleExt(3, 4)
        model._updateSuspectsGroups()
        expect(model._getBadGroup(0, () => 0)).toEqual({
            players: [1, 2],
            score: expect.closeTo(0.10202109375, 12),
        })
        expect(model._getSuspicious(1)).toBeCloseTo(0.2900625, 12)
    })

    it('generalises mutual friendship and action evidence to triples', () => {
        const model = new PandSModel(8, 3)
        for (const [player, value] of [
            [1, 0.5],
            [2, 0.6],
            [3, 0.8],
        ]) {
            model.suspects[player].sampleExt(value, 1)
        }
        for (const [from, to, value] of [
            [1, 2, 0.2],
            [2, 1, 0.3],
            [1, 3, 0.4],
            [3, 1, 0.5],
            [2, 3, 0.6],
            [3, 2, 0.7],
        ])
            model.friends[from][to].value = value
        for (const [player, support, suspicious, good] of [
            [1, 0.2, 0.2, 0],
            [2, 0.4, 0.5, 0.5],
            [3, 0.5, 0.8, 1],
        ]) {
            model.supportSuspects[player].total = support
            model.suspeciousActions[player].sampleExt(suspicious, 1)
            model.possibleGoodActions[player].sampleExt(good, 1)
        }
        model._updateSuspectsGroups()
        expect(model._getBadGroup(0, () => 0)).toEqual({
            players: [1, 2, 3],
            score: expect.closeTo(0.07439488, 12),
        })
    })

    it('supports four suspects, preserves certain evidence, and excludes self', () => {
        const model = new PandSModel(10, 4)
        for (const player of [0, 1, 2, 3, 4])
            model.suspects[player].sampleExt(1, 1)
        model._updateSuspectsGroups()
        expect(model._getBadGroup(0, () => 0)).toEqual({
            players: [1, 2, 3, 4],
            score: 1,
        })
    })

    it('scales priors and uses seat order while there is no evidence', () => {
        const model = new PandSModel(8, 3)
        expect(model.friends[1][2].estimate()).toBe(0.375)
        expect(model.supportSuspects[1].estimate()).toBe(0.375)
        expect(model._getGood(0, 3, () => 0)).toEqual([3, 4, 5, 6, 7, 1, 2])
    })

    it('uses RNG to perturb group scores, without changing the stored evidence', () => {
        const model = new PandSModel(5, 2)
        for (const player of [1, 2, 3]) model.suspects[player].sampleExt(1, 1)
        model._updateSuspectsGroups()
        const sequence = [0, 0.99, 0, 0, 0, 0]
        expect(
            model._getBadGroup(0, () => sequence.shift() ?? 0).players,
        ).toEqual([1, 3])
        expect(model._getBadGroup(0, () => 0).players).toEqual([1, 2])
    })

    it('learns votes using the historical attempt and unavoidable-danger rule', () => {
        const model = new PandSModel(5, 2)
        model.onVoteComplete({
            self: 0,
            leader: 1,
            team: [1, 2, 3],
            votes: [true, true, true, false, true],
            round: 1,
            tries: 1,
            requiredSabotages: 1,
        })
        expect(model.suspeciousActions[4].estimate()).toBeCloseTo(1 / 3, 12)
        expect(model.suspeciousActions[3].estimate()).toBeCloseTo(1 / 3, 12)
        expect(model.possibleGoodActions[3].estimate()).toBe(1)
        expect(model.friends[1][4].estimate()).toBe(1)
        expect(model.friends[4][2].estimate()).toBeCloseTo(0.6, 12)
    })

    it('uses all sabotages as evidence even when the raid still succeeds', () => {
        const model = new PandSModel(8, 3)
        model.onMissionComplete({
            self: 0,
            team: [1, 2, 3, 4, 5],
            votes: Array(8).fill(true),
            round: 4,
            sabotaged: 1,
            requiredSabotages: 2,
        })
        expect(model.suspects[1].estimate()).toBeCloseTo(0.2, 12)
        expect(model.suspects[6].estimate()).toBe(1)
        expect(model.supportSuspects[6].estimate()).toBe(0.1875)
    })

    it('learns support from failure, and skips support updates on the first raid', () => {
        const model = new PandSModel(5, 2)
        const event = {
            self: 0,
            team: [1, 2],
            votes: [true, true, true, true, false],
            round: 1,
            sabotaged: 1,
            requiredSabotages: 1,
        }
        model.onMissionComplete(event)
        expect(model.supportSuspects[3].estimate()).toBe(0.4)
        model.onMissionComplete({ ...event, round: 2 })
        expect(model.supportSuspects[3].estimate()).toBe(0.7)
        expect(model.supportSuspects[4].estimate()).toBe(0.2)
        expect(model.suspects[1].estimate()).toBe(0.75)
    })
})
