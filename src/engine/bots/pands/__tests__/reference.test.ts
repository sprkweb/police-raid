import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PandSModel } from '../model'

const reference = JSON.parse(
    readFileSync(new URL('./reference.json', import.meta.url), 'utf8'),
)

describe('Python reference trace (five players)', () => {
    it('matches every active accumulator and the selected spy pair after each callback', () => {
        const model = new PandSModel(5, 2)
        const compare = (step: number, leader: number) => {
            const expected = reference[step]
            for (const key of [
                'suspects',
                'supportSuspects',
                'suspeciousActions',
                'possibleGoodActions',
            ] as const) {
                expect(
                    model[key].map((p) => p.estimate()),
                    `${expected.name}: ${key}`,
                ).toEqual(
                    expected[key].map((value: number) =>
                        expect.closeTo(value, 12),
                    ),
                )
            }
            expect(
                model.friends.map((row) => row.map((p) => p.estimate())),
            ).toEqual(
                expected.friends.map((row: number[]) =>
                    row.map((value) => expect.closeTo(value, 12)),
                ),
            )
            expect(model._getBadGroup(0, () => 0)).toEqual({
                players: expected.badGroup.players,
                score: expect.closeTo(expected.badGroup.score, 12),
            })
            expect(model._getGood(0, leader, () => 0)).toEqual(expected.good)
        }
        compare(0, 0)
        const first = {
            self: 0,
            leader: 0,
            team: [0, 1],
            votes: Array(5).fill(true),
            round: 1,
            tries: 1,
            requiredSabotages: 1,
        }
        model.onVoteComplete(first)
        compare(1, 0)
        model.onMissionComplete({ ...first, sabotaged: 1 })
        compare(2, 0)
        const second = {
            ...first,
            leader: 2,
            team: [2, 3, 4],
            votes: [false, true, true, false, true],
            round: 2,
        }
        model.onVoteComplete(second)
        compare(3, 2)
        model.onMissionComplete({ ...second, sabotaged: 0 })
        compare(4, 2)
    })
})
